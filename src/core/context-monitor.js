/**
 * Context Monitor
 * Tracks session cost, token usage, and command count.
 * Triggers automatic Handoff when thresholds are exceeded.
 * Writes session data to usage.log for the Dashboard.
 */

import * as fs from 'fs';
import { getCCSODataDir, getCCSOPath } from './storage-paths.js';
import {
  estimateRequestCostUsd,
  estimateRoutingDeltaUsd,
  getModelPricing,
  getPricingMethodology,
  normalizeModelFamily,
} from './pricing.js';

const LOG_DIR = getCCSODataDir();
const LOG_FILE = getCCSOPath('usage.log');
const LIVE_FILE = getCCSOPath('session_live.json');

const FEATURE_KEYS = [
  'trim-log',
  'truncate',
  'dedupe',
  'translate',
  'politeness',
  'code-compress',
  'output-hint',
  'model-routing',
  'cache',
];

function createFeatureSavings() {
  return Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, { inputTokens: 0, outputTokens: 0, totalTokens: 0, usd: 0 }]),
  );
}

function roundUsd(value) {
  return parseFloat(value.toFixed(6));
}

export class ContextMonitor {
  constructor(config) {
    this.config = config;
    this.backend = config.get('backend') || 'claude';
    this.methodology = getPricingMethodology(this.backend);
    this.sessionCost = 0;
    this.commandCount = 0;
    this.estimatedInputTokens = 0;
    this.estimatedOutputTokens = 0;
    this.tokensAvoided = 0;
    this.netSavingsUsd = 0;
    this.startTime = Date.now();
    this.handoffOccurred = false;
    this.currentModel = 'sonnet';
    this.featureSavings = createFeatureSavings();
    this.savingsBreakdownUsd = {
      promptReduction: 0,
      outputHints: 0,
      cache: 0,
      routing: 0,
    };

    this.costThreshold = config.get('costThreshold') || 0.80;
    this.commandThreshold = config.get('commandThreshold') || 25;
    this.timeThresholdMs = (config.get('timeThresholdHours') || 2) * 60 * 60 * 1000;
  }

  /**
   * Track a completed turn.
   * @param {object} options
   * @param {number} options.promptTokens
   * @param {number} options.outputTokens
   * @param {string} options.model
   * @param {Array} options.savingsBreakdown
   * @param {boolean} options.cacheHit
   */
  trackTurn({
    promptTokens = 0,
    outputTokens = 0,
    model = 'sonnet',
    savingsBreakdown = [],
    cacheHit = false,
  } = {}) {
    this.currentModel = normalizeModelFamily(model);

    if (!cacheHit) {
      this.estimatedInputTokens += promptTokens;
      this.estimatedOutputTokens += outputTokens;
      if (this.methodology.pricingAvailable) {
        const actual = estimateRequestCostUsd({
          model: this.currentModel,
          inputTokens: promptTokens,
          outputTokens,
        });
        this.sessionCost += actual.totalCostUsd;

        const routingUsd = estimateRoutingDeltaUsd({
          model: this.currentModel,
          inputTokens: promptTokens,
          outputTokens,
          baselineModel: 'sonnet',
        });
        this.savingsBreakdownUsd.routing += routingUsd;
        this.featureSavings['model-routing'].usd += routingUsd;
      }
    } else {
      this.tokensAvoided += promptTokens + outputTokens;
      this.featureSavings.cache.inputTokens += promptTokens;
      this.featureSavings.cache.outputTokens += outputTokens;
      this.featureSavings.cache.totalTokens += promptTokens + outputTokens;

      if (this.methodology.pricingAvailable) {
        const avoided = estimateRequestCostUsd({
          model: this.currentModel,
          inputTokens: promptTokens,
          outputTokens,
        });
        this.savingsBreakdownUsd.cache += avoided.totalCostUsd;
        this.featureSavings.cache.usd += avoided.totalCostUsd;
      }
    }

    if (!cacheHit && this.methodology.pricingAvailable) {
      const pricing = getModelPricing(this.currentModel);
      for (const item of savingsBreakdown) {
        const kind = item?.kind || 'input';
        const saved = item?.saved || 0;
        const feature = this.featureSavings[item.step];
        if (!feature || saved <= 0) continue;

        if (kind === 'output') {
          const usd = saved * pricing.outputUsdPerToken;
          feature.outputTokens += saved;
          feature.totalTokens += saved;
          feature.usd += usd;
          this.tokensAvoided += saved;
          this.savingsBreakdownUsd.outputHints += usd;
        } else {
          const usd = saved * pricing.inputUsdPerToken;
          feature.inputTokens += saved;
          feature.totalTokens += saved;
          feature.usd += usd;
          this.tokensAvoided += saved;
          this.savingsBreakdownUsd.promptReduction += usd;
        }
      }
    } else if (!cacheHit) {
      for (const item of savingsBreakdown) {
        const kind = item?.kind || 'input';
        const saved = item?.saved || 0;
        const feature = this.featureSavings[item.step];
        if (!feature || saved <= 0) continue;

        if (kind === 'output') feature.outputTokens += saved;
        else feature.inputTokens += saved;
        feature.totalTokens += saved;
        this.tokensAvoided += saved;
      }
    }

    this.netSavingsUsd = Object.values(this.savingsBreakdownUsd).reduce((sum, value) => sum + value, 0);
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
        active: true,
        updatedAt: new Date().toISOString(),
        backend: this.backend,
        cost: roundUsd(this.sessionCost),
        commands: this.commandCount,
        tokensSaved: this.tokensAvoided,
        dollarsSaved: roundUsd(this.netSavingsUsd),
        model: this.currentModel,
        duration: Math.round((Date.now() - this.startTime) / 60000),
        estimatedInputTokens: this.estimatedInputTokens,
        estimatedOutputTokens: this.estimatedOutputTokens,
        estimatedTokensAvoided: this.tokensAvoided,
        estimatedNetSavingsUsd: roundUsd(this.netSavingsUsd),
        savingsBreakdownUsd: {
          promptReduction: roundUsd(this.savingsBreakdownUsd.promptReduction),
          outputHints: roundUsd(this.savingsBreakdownUsd.outputHints),
          cache: roundUsd(this.savingsBreakdownUsd.cache),
          routing: roundUsd(this.savingsBreakdownUsd.routing),
        },
        featureSavings: Object.fromEntries(
          Object.entries(this.featureSavings).map(([key, value]) => [
            key,
            {
              inputTokens: value.inputTokens,
              outputTokens: value.outputTokens,
              totalTokens: value.totalTokens,
              usd: roundUsd(value.usd),
            },
          ]),
        ),
        methodology: this.methodology,
      };
      fs.writeFileSync(LIVE_FILE, JSON.stringify(live));
    } catch {
      /* ignore */
    }
  }

  _clearLive() {
    try {
      fs.rmSync(LIVE_FILE, { force: true });
    } catch {
      /* ignore */
    }
  }

  shouldHandoff() {
    if (this.sessionCost >= this.costThreshold) return true;
    if (this.commandCount >= this.commandThreshold) return true;
    if (Date.now() - this.startTime >= this.timeThresholdMs) return true;
    return false;
  }

  getStatus() {
    const elapsed = Math.round((Date.now() - this.startTime) / 60000);
    const costPct = Math.min(100, Math.round((this.sessionCost / this.costThreshold) * 100));
    const cmdPct = Math.min(100, Math.round((this.commandCount / this.commandThreshold) * 100));
    const usedPct = Math.max(costPct, cmdPct);

    return {
      backend: this.backend,
      cost: this.sessionCost.toFixed(4),
      costThreshold: this.costThreshold,
      commands: this.commandCount,
      commandThreshold: this.commandThreshold,
      elapsedMinutes: elapsed,
      usedPercent: usedPct,
      tokensSaved: this.tokensAvoided,
      dollarsSaved: roundUsd(this.netSavingsUsd),
      model: this.currentModel,
      estimatedInputTokens: this.estimatedInputTokens,
      estimatedOutputTokens: this.estimatedOutputTokens,
      estimatedTokensAvoided: this.tokensAvoided,
      estimatedNetSavingsUsd: roundUsd(this.netSavingsUsd),
      savingsBreakdownUsd: {
        promptReduction: roundUsd(this.savingsBreakdownUsd.promptReduction),
        outputHints: roundUsd(this.savingsBreakdownUsd.outputHints),
        cache: roundUsd(this.savingsBreakdownUsd.cache),
        routing: roundUsd(this.savingsBreakdownUsd.routing),
      },
      featureSavings: Object.fromEntries(
        Object.entries(this.featureSavings).map(([key, value]) => [
          key,
          {
            inputTokens: value.inputTokens,
            outputTokens: value.outputTokens,
            totalTokens: value.totalTokens,
            usd: roundUsd(value.usd),
          },
        ]),
      ),
      methodology: this.methodology,
    };
  }

  /**
   * Save the current session summary to the usage log (for Dashboard).
   * Called automatically on Handoff or clean exit.
   */
  saveToLog(isHandoff = false) {
    if (
      this.commandCount === 0 &&
      this.estimatedInputTokens === 0 &&
      this.estimatedOutputTokens === 0 &&
      this.tokensAvoided === 0 &&
      this.sessionCost === 0
    ) {
      this._clearLive();
      return;
    }

    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      const entry = {
        type: 'session_end',
        timestamp: new Date().toISOString(),
        backend: this.backend,
        cost: roundUsd(this.sessionCost),
        commands: this.commandCount,
        tokensSaved: this.tokensAvoided,
        dollarsSaved: roundUsd(this.netSavingsUsd),
        model: this.currentModel,
        duration: Math.round((Date.now() - this.startTime) / 60000),
        handoff: isHandoff,
        estimatedInputTokens: this.estimatedInputTokens,
        estimatedOutputTokens: this.estimatedOutputTokens,
        estimatedTokensAvoided: this.tokensAvoided,
        estimatedNetSavingsUsd: roundUsd(this.netSavingsUsd),
        savingsBreakdownUsd: {
          promptReduction: roundUsd(this.savingsBreakdownUsd.promptReduction),
          outputHints: roundUsd(this.savingsBreakdownUsd.outputHints),
          cache: roundUsd(this.savingsBreakdownUsd.cache),
          routing: roundUsd(this.savingsBreakdownUsd.routing),
        },
        featureSavings: Object.fromEntries(
          Object.entries(this.featureSavings).map(([key, value]) => [
            key,
            {
              inputTokens: value.inputTokens,
              outputTokens: value.outputTokens,
              totalTokens: value.totalTokens,
              usd: roundUsd(value.usd),
            },
          ]),
        ),
        methodology: this.methodology,
      };
      fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
      if (!isHandoff) this._clearLive();
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
    this.sessionCost = 0;
    this.commandCount = 0;
    this.estimatedInputTokens = 0;
    this.estimatedOutputTokens = 0;
    this.tokensAvoided = 0;
    this.netSavingsUsd = 0;
    this.startTime = Date.now();
    this.handoffOccurred = false;
    this.featureSavings = createFeatureSavings();
    this.savingsBreakdownUsd = {
      promptReduction: 0,
      outputHints: 0,
      cache: 0,
      routing: 0,
    };
    this._saveLive();
  }
}
