/**
 * Context Monitor
 * Tracks session cost, token usage, and command count.
 * Triggers automatic Handoff when thresholds are exceeded.
 * Writes session data to usage.log for the Dashboard.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const LOG_DIR   = path.join(os.homedir(), '.config', 'claude-smart-optimizer');
const LOG_FILE  = path.join(LOG_DIR, 'usage.log');
const LIVE_FILE = path.join(LOG_DIR, 'session_live.json');

// Input token pricing per 1M tokens (USD)
const MODEL_PRICES = {
  'claude-haiku-4-5-20251001': 0.80,
  'claude-haiku-4-5':          0.80,
  'claude-sonnet-4-6':         3.00,
  'claude-opus-4-6':           15.00,
  'default':                   3.00,
};

function pricePerToken(model) {
  const key = Object.keys(MODEL_PRICES).find(k => model?.includes(k)) || 'default';
  return MODEL_PRICES[key] / 1_000_000;
}

export class ContextMonitor {
  constructor(config) {
    this.config = config;
    this.sessionCost    = 0;
    this.commandCount   = 0;
    this.outputTokens   = 0;
    this.tokensSaved    = 0;
    this.dollarsSaved   = 0;   // USD saved by CCSO optimizations
    this.startTime      = Date.now();
    this.handoffOccurred = false;
    this.currentModel   = 'claude-sonnet-4-6';
    // Per-feature savings breakdown
    this.featureSavings = {
      'trim-log':       0,
      'truncate':       0,
      'dedupe':         0,
      'translate':      0,
      'politeness':     0,
      'code-compress':  0,
      'output-hint':    0,
      'model-routing':  0,
      'cache':          0,
    };

    this.costThreshold    = config.get('costThreshold')    || 0.80;
    this.commandThreshold = config.get('commandThreshold') || 25;
    this.timeThresholdMs  = (config.get('timeThresholdHours') || 2) * 60 * 60 * 1000;
  }

  /**
   * Track output from Claude and estimate cost.
   * @param {string} outputText
   * @param {number} savedTokens — input tokens saved by CCSO
   * @param {string} model — model used for this prompt
   * @param {Array}  savingsBreakdown — per-feature savings array from interceptor
   */
  trackOutput(outputText, savedTokens = 0, model = null, savingsBreakdown = []) {
    if (model) this.currentModel = model;
    const price        = pricePerToken(this.currentModel);
    const defaultPrice = pricePerToken('claude-sonnet-4-6');

    const outputTok = Math.ceil(outputText.length / 4);
    this.outputTokens += outputTok;
    this.sessionCost  += outputTok * price;

    // Savings from input token reduction (all interceptor features)
    if (savedTokens > 0) {
      this.tokensSaved  += savedTokens;
      this.dollarsSaved += savedTokens * price;
    }

    // Per-feature breakdown
    for (const { step, saved } of savingsBreakdown) {
      if (this.featureSavings[step] !== undefined) {
        this.featureSavings[step] += saved;
      }
    }

    // Savings from model routing: difference between Sonnet and actual model cost
    if (price < defaultPrice) {
      const routingTokSaved = outputTok * (defaultPrice - price) / price;
      const routingSavedUSD = outputTok * (defaultPrice - price);
      this.dollarsSaved += routingSavedUSD;
      this.tokensSaved  += Math.ceil(routingTokSaved);
      this.featureSavings['model-routing'] += Math.ceil(routingTokSaved);
    }

    this._saveLive();
  }

  /** Track a cache hit (full response saved) */
  trackCacheHit(savedTokens = 0) {
    this.tokensSaved  += savedTokens;
    this.dollarsSaved += savedTokens * pricePerToken(this.currentModel);
    this.featureSavings['cache'] += savedTokens;
    this._saveLive();
  }

  trackCommand() {
    this.commandCount++;
    this._saveLive();
  }

  /** Write current session state to a live file so the dashboard can read it in real time */
  _saveLive() {
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      const live = {
        active:        true,
        updatedAt:     new Date().toISOString(),
        cost:          parseFloat(this.sessionCost.toFixed(6)),
        commands:      this.commandCount,
        tokensSaved:   this.tokensSaved,
        dollarsSaved:  parseFloat(this.dollarsSaved.toFixed(6)),
        model:         this.currentModel,
        duration:      Math.round((Date.now() - this.startTime) / 60000),
        featureSavings: { ...this.featureSavings },
      };
      fs.writeFileSync(LIVE_FILE, JSON.stringify(live));
    } catch { /* ignore */ }
  }

  shouldHandoff() {
    if (this.sessionCost   >= this.costThreshold)    return true;
    if (this.commandCount  >= this.commandThreshold) return true;
    if (Date.now() - this.startTime >= this.timeThresholdMs) return true;
    return false;
  }

  getStatus() {
    const elapsed  = Math.round((Date.now() - this.startTime) / 60000);
    const costPct  = Math.min(100, Math.round((this.sessionCost / this.costThreshold) * 100));
    const cmdPct   = Math.min(100, Math.round((this.commandCount / this.commandThreshold) * 100));
    const usedPct  = Math.max(costPct, cmdPct);

    return {
      cost:             this.sessionCost.toFixed(4),
      costThreshold:    this.costThreshold,
      commands:         this.commandCount,
      commandThreshold: this.commandThreshold,
      elapsedMinutes:   elapsed,
      usedPercent:      usedPct,
      tokensSaved:      this.tokensSaved,
      dollarsSaved:     parseFloat(this.dollarsSaved.toFixed(6)),
      model:            this.currentModel,
      featureSavings:   { ...this.featureSavings },
    };
  }

  /**
   * Save the current session summary to the usage log (for Dashboard).
   * Called automatically on Handoff or clean exit.
   */
  saveToLog(isHandoff = false) {
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      const entry = {
        type:          'session_end',
        timestamp:     new Date().toISOString(),
        cost:          parseFloat(this.sessionCost.toFixed(6)),
        commands:      this.commandCount,
        tokensSaved:   this.tokensSaved,
        dollarsSaved:  parseFloat(this.dollarsSaved.toFixed(6)),
        model:         this.currentModel,
        duration:      Math.round((Date.now() - this.startTime) / 60000),
        handoff:       isHandoff,
        featureSavings: { ...this.featureSavings },
      };
      fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
    } catch {
      // Silently ignore log write failures — never crash the CLI
    }
  }

  markHandoff() {
    this.handoffOccurred = true;
    this.saveToLog(true);
    this.reset();
  }

  reset() {
    this.sessionCost     = 0;
    this.commandCount    = 0;
    this.outputTokens    = 0;
    this.tokensSaved     = 0;
    this.dollarsSaved    = 0;
    this.startTime       = Date.now();
    this.handoffOccurred = false;
    for (const k of Object.keys(this.featureSavings)) this.featureSavings[k] = 0;
  }
}
