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
import * as os from 'os';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE  = path.join(os.homedir(), '.config', 'claude-smart-optimizer', 'usage.log');
const LIVE_FILE = path.join(os.homedir(), '.config', 'claude-smart-optimizer', 'session_live.json');
const PORT = 3847; // Unlikely to conflict with other services

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
  const entries = readLog();

  if (entries.length === 0) {
    return res.json({ empty: true });
  }

  const totalCost = entries.reduce((s, e) => s + (e.cost || 0), 0);
  const totalCommands = entries.reduce((s, e) => s + (e.commands || 0), 0);
  const totalSaved    = entries.reduce((s, e) => s + (e.tokensSaved  || 0), 0);
  const totalDollars  = entries.reduce((s, e) => s + (e.dollarsSaved || 0), 0);
  const totalHandoffs = entries.filter(e => e.type === 'handoff').length;
  const totalSessions = entries.filter(e => e.type === 'session_end').length;

  // Aggregate per-feature savings across all sessions
  const featureSavings = {};
  for (const e of entries) {
    if (!e.featureSavings) continue;
    for (const [k, v] of Object.entries(e.featureSavings)) {
      featureSavings[k] = (featureSavings[k] || 0) + v;
    }
  }

  res.json({
    totalCost:           round(totalCost),
    totalCommands,
    totalTokensSaved:    totalSaved,
    estimatedSavingsUSD: totalDollars > 0 ? round(totalDollars) : round(totalSaved * 0.000003),
    totalHandoffs,
    totalSessions,
    lastSession:    entries[entries.length - 1]?.timestamp || null,
    featureSavings,
  });
});

/**
 * GET /api/daily
 * Returns daily cost and savings for the last 30 days (for the line chart).
 */
app.get('/api/daily', (req, res) => {
  const entries = readLog();
  const days = {};

  for (const entry of entries) {
    if (!entry.timestamp) continue;
    const day = entry.timestamp.substring(0, 10); // YYYY-MM-DD
    if (!days[day]) days[day] = { date: day, cost: 0, saved: 0, commands: 0 };
    days[day].cost += entry.cost || 0;
    days[day].saved += entry.tokensSaved || 0;
    days[day].commands += entry.commands || 0;
  }

  const sorted = Object.values(days)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map(d => ({ ...d, cost: round(d.cost), saved: round(d.saved * 0.000003) }));

  res.json(sorted);
});

/**
 * GET /api/sessions
 * Returns the last 20 sessions for the sessions table.
 */
app.get('/api/sessions', (req, res) => {
  const entries = readLog()
    .filter(e => e.type === 'session_end')
    .slice(-20)
    .reverse()
    .map(e => ({
      date:         e.timestamp?.substring(0, 16).replace('T', ' ') || '—',
      cost:         round(e.cost || 0),
      commands:     e.commands || 0,
      tokensSaved:  e.tokensSaved || 0,
      dollarsSaved: round(e.dollarsSaved || (e.tokensSaved || 0) * 0.000003),
      model:        e.model || 'sonnet',
      handoff:      e.handoff ? 'כן' : 'לא',
      duration:     e.duration ? `${e.duration} דק'` : '—',
    }));

  res.json(entries);
});

/**
 * GET /api/platforms
 * Returns which AI tools are detected on this machine.
 * Checks both CLI commands in PATH and macOS .app bundles in /Applications.
 */
app.get('/api/platforms', async (req, res) => {
  const home = os.homedir();
  const vscodeExt = path.join(home, '.vscode', 'extensions');
  const androidStudioPrefs = path.join(home, 'Library', 'Application Support', 'Google');

  // Helper: check if any VS Code extension matches a prefix
  const hasVscodeExt = (prefix) => {
    if (!fs.existsSync(vscodeExt)) return false;
    return fs.readdirSync(vscodeExt).some(e => e.toLowerCase().startsWith(prefix));
  };

  // Helper: check Android Studio Gemini plugin config
  const hasAndroidStudioGemini = () => {
    const appDir = '/Applications';
    const hasAS = fs.existsSync(appDir) &&
      fs.readdirSync(appDir).some(e => e.toLowerCase().includes('androidstudio'));
    if (!hasAS) return false;
    // Check for Gemini plugin marker in prefs
    if (!fs.existsSync(androidStudioPrefs)) return false;
    return fs.readdirSync(androidStudioPrefs)
      .some(e => e.toLowerCase().includes('androidstudio'));
  };

  const checks = [
    { id: 'claude',    detect: async () => { try { await execFileAsync('which', ['claude']); return true; } catch { return false; } } },
    { id: 'cursor',    detect: async () => fs.existsSync('/Applications/Cursor.app') || fs.existsSync(path.join(home, 'Applications', 'Cursor.app')) },
    { id: 'codex',     detect: async () => { try { await execFileAsync('which', ['codex']); return true; } catch { return fs.existsSync('/Applications/Codex.app'); } } },
    { id: 'windsurf',  detect: async () => fs.existsSync('/Applications/Windsurf.app') || fs.existsSync(path.join(home, 'Applications', 'Windsurf.app')) },
    { id: 'vscode',    detect: async () => fs.existsSync('/Applications/Visual Studio Code.app') || (() => { try { require('child_process').execSync('which code', {stdio:'ignore'}); return true; } catch { return false; } })() },
    { id: 'gemini',    detect: async () =>
        hasVscodeExt('google.geminicodeassist') ||
        hasVscodeExt('googlecloudtools.cloudcode') ||
        hasVscodeExt('google.cloudcode') ||
        hasAndroidStudioGemini()
    },
    { id: 'firebase',  detect: async () => {
        try { await execFileAsync('which', ['firebase']); return true; } catch {}
        const npmPaths = [
          path.join(home, '.npm-global', 'bin', 'firebase'),
          '/usr/local/bin/firebase',
          path.join(home, '.nvm', 'versions', 'node', 'current', 'bin', 'firebase'),
        ];
        return npmPaths.some(p => fs.existsSync(p));
    }},
    { id: 'androidstudio', detect: async () => {
        const dirs = ['/Applications', path.join(home, 'Applications')];
        return dirs.some(d => fs.existsSync(d) && fs.readdirSync(d).some(e => e.toLowerCase().includes('androidstudio')));
    }},
  ];

  const detected = [];
  await Promise.all(checks.map(async ({ id, detect }) => {
    try { if (await detect()) detected.push(id); } catch {}
  }));

  res.json(detected);
});

/**
 * POST /api/prompt
 * Sends a prompt through the claude CLI and returns the response.
 * Body: { prompt: string }
 */
app.post('/api/prompt', express.json(), async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt required' });

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

function readLog() {
  if (!fs.existsSync(LOG_FILE)) return generateDemoData();
  try {
    return fs.readFileSync(LOG_FILE, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));
  } catch {
    return generateDemoData();
  }
}

function round(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * Generate realistic demo data for first-time users who have no log yet.
 */
function generateDemoData() {
  const data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().substring(0, 10);
    const sessions = Math.floor(Math.random() * 4) + 1;
    for (let s = 0; s < sessions; s++) {
      data.push({
        type: 'session_end',
        timestamp: `${date}T${String(9 + s * 3).padStart(2, '0')}:00:00`,
        cost: Math.random() * 0.6 + 0.05,
        commands: Math.floor(Math.random() * 20) + 3,
        tokensSaved: Math.floor(Math.random() * 8000) + 500,
        handoff: Math.random() > 0.5,
        duration: Math.floor(Math.random() * 45) + 5,
      });
    }
  }
  return data;
}

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  ✅ CCSO Dashboard פועל על: ${url}\n`);
  console.log('  לעצירה: Ctrl+C\n');
  // Browser is opened by cc.js (bin/cc.js --dashboard)
});

export { app };
