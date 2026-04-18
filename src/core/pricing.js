const MODEL_FAMILY_PRICING = {
  haiku: {
    family: 'haiku',
    label: 'Claude Haiku',
    inputUsdPerMTok: 0.8,
    outputUsdPerMTok: 4,
  },
  sonnet: {
    family: 'sonnet',
    label: 'Claude Sonnet',
    inputUsdPerMTok: 3,
    outputUsdPerMTok: 15,
  },
  opus: {
    family: 'opus',
    label: 'Claude Opus',
    inputUsdPerMTok: 15,
    outputUsdPerMTok: 75,
  },
};

export const CLAUDE_PRICING_SOURCE = {
  label: 'Anthropic pricing',
  url: 'https://docs.anthropic.com/en/docs/about-claude/pricing',
  verifiedDate: '2026-04-17',
  note: 'Using Claude family rates: Haiku $0.80/$4, Sonnet $3/$15, Opus $15/$75 per million input/output tokens.',
};

export function normalizeModelFamily(model = 'sonnet') {
  const lower = String(model || 'sonnet').toLowerCase();
  if (lower.includes('haiku')) return 'haiku';
  if (lower.includes('opus')) return 'opus';
  return 'sonnet';
}

export function getModelPricing(model = 'sonnet') {
  const family = normalizeModelFamily(model);
  const pricing = MODEL_FAMILY_PRICING[family];
  return {
    ...pricing,
    inputUsdPerToken: pricing.inputUsdPerMTok / 1_000_000,
    outputUsdPerToken: pricing.outputUsdPerMTok / 1_000_000,
  };
}

export function estimateRequestCostUsd({ model = 'sonnet', inputTokens = 0, outputTokens = 0 } = {}) {
  const pricing = getModelPricing(model);
  const inputCostUsd = inputTokens * pricing.inputUsdPerToken;
  const outputCostUsd = outputTokens * pricing.outputUsdPerToken;
  return {
    ...pricing,
    inputTokens,
    outputTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
  };
}

export function estimateRoutingDeltaUsd({
  model = 'sonnet',
  inputTokens = 0,
  outputTokens = 0,
  baselineModel = 'sonnet',
} = {}) {
  const actual = estimateRequestCostUsd({ model, inputTokens, outputTokens });
  const baseline = estimateRequestCostUsd({ model: baselineModel, inputTokens, outputTokens });
  return baseline.totalCostUsd - actual.totalCostUsd;
}

export function getPricingMethodology(backend = 'claude') {
  const pricingAvailable = backend === 'claude';
  return {
    backend,
    pricingAvailable,
    tokenCounting: 'estimated-local',
    spendIncludes: 'Estimated input tokens CCSO sent plus output tokens CCSO received.',
    savingsIncludes: [
      'Prompt reduction before send',
      'Estimated shorter outputs from brevity hints',
      'Cache hits that avoided full requests',
      'Routing delta versus the Sonnet family baseline',
    ],
    pricingSource: pricingAvailable ? CLAUDE_PRICING_SOURCE : null,
    note: pricingAvailable
      ? 'CCSO estimates usage locally for turns it sends itself. IDE-only integrations such as Cursor/Copilot are not included in spend or savings.'
      : 'Cost and savings estimates are only configured for Claude-family backends.',
  };
}
