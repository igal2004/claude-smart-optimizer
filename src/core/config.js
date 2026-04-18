/**
 * Config Manager
 * Loads and saves user configuration using the 'conf' package.
 * Canonical config stored at: <CCSO data dir>/config.json
 */

import * as fs from 'fs';
import Conf from 'conf';
import { getCCSODataDir, getCCSOPath } from './storage-paths.js';
import { CONFIG_SCHEMA_VERSION, getDefaultConfig } from './default-config.js';

let _config = null;

function readJson(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function upgradeConfigProfile(config, rawConfig = null) {
  const version = Number(rawConfig?.configSchemaVersion || 0);
  if (version >= CONFIG_SCHEMA_VERSION) return;

  const updates = {
    configSchemaVersion: CONFIG_SCHEMA_VERSION,
    responseLengthHints: false,
    truncateLargePastes: false,
    dedupeLongInput: false,
    briefsEnabled: true,
    briefTokenBudget: 220,
    resetAdvisor: true,
    resetAdvisorTurns: 15,
    resetAdvisorMinutes: 90,
    resetAdvisorTokenThreshold: 12000,
  };

  if (rawConfig?.translate === true) updates.translate = false;
  if (rawConfig?.codeCompression === true) updates.codeCompression = false;

  try {
    for (const [key, value] of Object.entries(updates)) {
      config.set(key, value);
    }
  } catch {
    // Best-effort migration only. Never crash startup because config cannot be rewritten.
  }
}

export function loadConfig() {
  if (_config) return _config;

  const configDir = getCCSODataDir();
  const configPath = getCCSOPath('config.json');

  fs.mkdirSync(configDir, { recursive: true });

  // Legacy location used by older CCSO builds on macOS/Conf defaults.
  const shouldProbeLegacy = !process.env.CCSO_HOME;
  const legacyProbe = shouldProbeLegacy ? new Conf({ projectName: 'claude-smart-optimizer' }) : null;
  const legacyPath = legacyProbe?.path;
  const legacyConfig = legacyPath && legacyPath !== configPath ? readJson(legacyPath) : null;
  const sharedConfig = readJson(configPath);

  _config = new Conf({
    projectName: 'claude-smart-optimizer',
    cwd: configDir,
    configName: 'config',
    defaults: getDefaultConfig(),
  });

  // Migrate only when the old Conf location exists and the canonical shared file does not.
  if (!sharedConfig && legacyConfig) {
    _config.store = {
      ...getDefaultConfig(),
      ...legacyConfig,
      adapters: {
        ...getDefaultConfig().adapters,
        ...(legacyConfig.adapters || {}),
      },
    };
  }

  upgradeConfigProfile(_config, sharedConfig || legacyConfig);

  return _config;
}
