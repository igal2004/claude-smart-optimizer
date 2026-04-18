export const CONFIG_SCHEMA_VERSION = 3;

const BASE_DEFAULT_CONFIG = {
  configSchemaVersion: CONFIG_SCHEMA_VERSION,

  // Backend
  backend: 'claude',

  // Input processing
  translate: false,
  stripPoliteness: true,
  resolvePaths: true,
  trimLogs: true,
  truncateLargePastes: false,
  dedupeLongInput: false,
  codeCompression: false,
  responseLengthHints: false,
  secretScanner: true,
  gitContext: true,

  // Intelligence
  smartRouting: true,
  promptCache: true,
  cacheTTLHours: 24,
  briefsEnabled: true,
  briefTokenBudget: 220,

  // Memory & history
  memoryEnabled: true,
  memoryTokenBudget: 180,
  memoryMaxFacts: 6,
  promptHistory: true,
  resetAdvisor: true,
  resetAdvisorTurns: 15,
  resetAdvisorMinutes: 90,
  resetAdvisorTokenThreshold: 12000,

  // Handoff triggers
  costThreshold: 0.80,
  commandThreshold: 25,
  timeThresholdHours: 2,

  // Time guard
  timeGuard: true,
  timezone: 'Asia/Jerusalem',

  // Tool adapters
  adapters: {
    claudeCode: true,
    cursor: false,
    windsurf: false,
    copilot: false,
    gemini: false,
    firebaseStudio: false,
    notebooklm: true,
  },
};

export function getDefaultConfig() {
  return {
    ...BASE_DEFAULT_CONFIG,
    backend: process.env.CCSO_BACKEND || BASE_DEFAULT_CONFIG.backend,
    adapters: {
      ...BASE_DEFAULT_CONFIG.adapters,
    },
  };
}

export function getDefaultConfigValue(key) {
  return getDefaultConfig()[key];
}

export function getConfigValue(config, key) {
  const value = config?.get?.(key);
  return value === undefined ? getDefaultConfigValue(key) : value;
}
