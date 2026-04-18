/**
 * CCSO Dashboard Server
 * Lightweight Express server that serves the dashboard UI and exposes
 * a read-only API over the local log file.
 *
 * Start: node src/dashboard/server.js
 * Or via: cc --dashboard
 */

import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { loadConfig } from '../core/config.js';
import { getCCSOPath } from '../core/storage-paths.js';
import { getPricingMethodology } from '../core/pricing.js';
import { getFeatureCatalog, getFeatureStateMap } from '../core/feature-catalog.js';
import { getSupportedPlatformStatuses } from '../core/platform-support.js';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE  = getCCSOPath('usage.log');
const LIVE_FILE = getCCSOPath('session_live.json');
const PORT = 3847; // Unlikely to conflict with other services
const config = loadConfig();

const app = express();

// Serve static dashboard files
app.use(express.static(path.join(__dirname, 'public')));

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * GET /api/live
 * Returns the current active session stats (written after every command).
 */
app.get('/api/live', (req, res) => {
  try {
    if (!fs.existsSync(LIVE_FILE)) return res.json({ active: false });
    const live = JSON.parse(fs.readFileSync(LIVE_FILE, 'utf8'));
    // Consider stale if not updated in 10 minutes
    const age = Date.now() - new Date(live.updatedAt).getTime();
    if (age > 10 * 60 * 1000) return res.json({ active: false });
    return res.json(live);
  } catch {
    return res.json({ active: false });
  }
});

/**
 * GET /api/stats
 * Returns aggregated statistics from the usage log.
 */
app.get('/api/stats', (req, res) => {
  const { entries } = readLogData();
  const backend = config.get('backend') || 'claude';
  const methodology = getPricingMethodology(backend);
  const featureCatalog = getFeatureCatalog(config);
  const featureStates = getFeatureStateMap(config);
  const optimizerSettings = getOptimizerSettings(config);

  const totalCost = entries.reduce((sum, entry) => sum + (entry.cost || 0), 0);
  const totalCommands = entries.reduce((sum, entry) => sum + (entry.commands || 0), 0);
  const totalTokensAvoided = entries.reduce((sum, entry) => sum + (entry.estimatedTokensAvoided || entry.tokensSaved || 0), 0);
  const totalNetSavingsUsd = entries.reduce((sum, entry) => sum + (entry.estimatedNetSavingsUsd || entry.dollarsSaved || 0), 0);
  const totalInputTokens = entries.reduce((sum, entry) => sum + (entry.estimatedInputTokens || 0), 0);
  const totalOutputTokens = entries.reduce((sum, entry) => sum + (entry.estimatedOutputTokens || 0), 0);
  const totalHandoffs = entries.filter(entry => entry.handoff).length;
  const totalSessions = entries.filter(entry => entry.type === 'session_end').length;

  // Aggregate per-feature savings across all sessions
  const featureSavings = {};
  const savingsBreakdownUsd = {
    promptReduction: 0,
    outputHints: 0,
    cache: 0,
    routing: 0,
  };
  for (const e of entries) {
    if (e.savingsBreakdownUsd) {
      savingsBreakdownUsd.promptReduction += e.savingsBreakdownUsd.promptReduction || 0;
      savingsBreakdownUsd.outputHints += e.savingsBreakdownUsd.outputHints || 0;
      savingsBreakdownUsd.cache += e.savingsBreakdownUsd.cache || 0;
      savingsBreakdownUsd.routing += e.savingsBreakdownUsd.routing || 0;
    }
    if (!e.featureSavings) continue;
    for (const [k, v] of Object.entries(e.featureSavings)) {
      if (!featureSavings[k]) {
        featureSavings[k] = { inputTokens: 0, outputTokens: 0, totalTokens: 0, usd: 0 };
      }
      if (typeof v === 'number') {
        featureSavings[k].totalTokens += v;
      } else {
        featureSavings[k].inputTokens += v.inputTokens || 0;
        featureSavings[k].outputTokens += v.outputTokens || 0;
        featureSavings[k].totalTokens += (v.totalTokens || 0) || ((v.inputTokens || 0) + (v.outputTokens || 0));
        featureSavings[k].usd += v.usd || 0;
      }
    }
  }

  res.json({
    backend,
    totalCost:           round(totalCost),
    totalCommands,
    totalTokensAvoided,
    totalInputTokens,
    totalOutputTokens,
    estimatedNetSavingsUsd: round(totalNetSavingsUsd),
    totalHandoffs,
    totalSessions,
    lastSession:    entries[entries.length - 1]?.timestamp || null,
    featureSavings: Object.fromEntries(
      Object.entries(featureSavings).map(([key, value]) => [key, {
        inputTokens: value.inputTokens,
        outputTokens: value.outputTokens,
        totalTokens: value.totalTokens,
        usd: round(value.usd),
      }]),
    ),
    savingsBreakdownUsd: {
      promptReduction: round(savingsBreakdownUsd.promptReduction),
      outputHints: round(savingsBreakdownUsd.outputHints),
      cache: round(savingsBreakdownUsd.cache),
      routing: round(savingsBreakdownUsd.routing),
    },
    methodology,
    featureCatalog,
    featureStates,
    optimizerSettings,
    chatSupported: backend === 'claude',
    empty: entries.length === 0,
  });
});

/**
 * GET /api/daily
 * Returns daily cost and savings for the last 30 days (for the line chart).
 */
app.get('/api/daily', (req, res) => {
  const { entries } = readLogData();
  const days = {};

  for (const entry of entries) {
    if (!entry.timestamp) continue;
    const day = entry.timestamp.substring(0, 10); // YYYY-MM-DD
    if (!days[day]) days[day] = { date: day, cost: 0, saved: 0, commands: 0 };
    days[day].cost += entry.cost || 0;
    days[day].saved += entry.estimatedNetSavingsUsd || entry.dollarsSaved || 0;
    days[day].commands += entry.commands || 0;
  }

  const sorted = Object.values(days)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map(d => ({ ...d, cost: round(d.cost), saved: round(d.saved) }));

  res.json(sorted);
});

/**
 * GET /api/sessions
 * Returns the last 20 sessions for the sessions table.
 */
app.get('/api/sessions', (req, res) => {
  const { entries } = readLogData();
  const items = entries
    .filter(e => e.type === 'session_end')
    .slice(-20)
    .reverse()
    .map(e => ({
      date:         e.timestamp?.substring(0, 16).replace('T', ' ') || '—',
      cost:         round(e.cost || 0),
      commands:     e.commands || 0,
      tokensAvoided:  e.estimatedTokensAvoided || e.tokensSaved || 0,
      netSavingsUsd: round(e.estimatedNetSavingsUsd || e.dollarsSaved || 0),
      model:        e.model || 'sonnet',
      backend:      e.backend || 'claude',
      handoff:      e.handoff ? 'כן' : 'לא',
      duration:     e.duration ? `${e.duration} דק'` : '—',
    }));

  res.json(items);
});

/**
 * GET /api/platforms
 * Returns which AI tools are detected on this machine.
 * Checks both CLI commands in PATH and macOS .app bundles in /Applications.
 */
app.get('/api/platforms', async (req, res) => {
  res.json(await getSupportedPlatformStatuses());
});

/**
 * POST /api/prompt
 * Sends a prompt through the claude CLI and returns the response.
 * Body: { prompt: string }
 */
app.post('/api/prompt', express.json(), async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt required' });
  const backend = config.get('backend') || 'claude';
  if (backend !== 'claude') {
    return res.status(400).json({
      error: `Dashboard chat currently supports the Claude backend only. Current backend: ${backend}`,
    });
  }

  // Basic secret scan
  const warnings = [];
  if (/sk-[a-zA-Z0-9]{20,}/.test(prompt)) warnings.push('זוהה מפתח API אפשרי בפרומפט');
  if (/AKIA[A-Z0-9]{16}/.test(prompt))     warnings.push('זוהה מפתח AWS אפשרי בפרומפט');

  // Simple Hebrew detection (for metadata)
  const hasHebrew = /[\u0590-\u05FF]/.test(prompt);

  // Model routing
  const lower = prompt.toLowerCase();
  let model = null;
  if (/^(what|מה|how|תסביר|explain|hello|שלום|hi|yes|no|כן|לא)\b/.test(lower.trim())) {
    model = 'claude-haiku-4-5-20251001';
  } else if (/(architect|design|refactor|system|optimize|security|ארכיטקטורה)/.test(lower)) {
    model = 'claude-opus-4-6';
  }

  const args = ['--print', prompt];
  if (model) args.unshift('--model', model);

  try {
    const { stdout, stderr } = await execFileAsync('claude', args, { timeout: 120_000 });
    res.json({
      response: stdout.trim() || stderr.trim(),
      model: model || 'claude-sonnet-4-6',
      translated: hasHebrew,
      warnings,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, warnings });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function readLogData() {
  if (!fs.existsSync(LOG_FILE)) return { entries: [] };
  try {
    return {
      entries: fs.readFileSync(LOG_FILE, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line)),
    };
  } catch {
    return { entries: [] };
  }
}

function round(n) {
  return Math.round(n * 10000) / 10000;
}

function getOptimizerSettings(currentConfig) {
  const promptCacheEnabled = currentConfig.get('promptCache') !== false;
  const memoryEnabled = currentConfig.get('memoryEnabled') !== false;

  return {
    promptCache: {
      enabled: promptCacheEnabled,
      ttlHours: Number(currentConfig.get('cacheTTLHours')) || 24,
      mode: promptCacheEnabled ? 'conservative-normalization' : 'disabled',
    },
    memory: {
      enabled: memoryEnabled,
      tokenBudget: Number(currentConfig.get('memoryTokenBudget')) || 180,
      maxFacts: Number(currentConfig.get('memoryMaxFacts')) || 6,
      mode: memoryEnabled ? 'relevance-scoped' : 'disabled',
    },
    trimLogs: {
      enabled: currentConfig.get('trimLogs') !== false,
      mode: 'error-focused',
    },
    routing: {
      enabled: currentConfig.get('smartRouting') !== false,
      baselineModel: 'sonnet',
    },
    translate: {
      enabled: currentConfig.get('translate') === true,
    },
    responseHints: {
      enabled: currentConfig.get('responseLengthHints') === true,
    },
    truncateLargePastes: {
      enabled: currentConfig.get('truncateLargePastes') === true,
    },
    dedupeLongInput: {
      enabled: currentConfig.get('dedupeLongInput') === true,
    },
    codeCompression: {
      enabled: currentConfig.get('codeCompression') === true,
    },
  };
}

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  ✅ CCSO Dashboard פועל על: ${url}\n`);
  console.log('  לעצירה: Ctrl+C\n');
  // Browser is opened by cc.js (bin/cc.js --dashboard)
});

export { app };
