/**
 * Config Manager
 * Loads and saves user configuration using the 'conf' package.
 * Config stored at: ~/.config/claude-smart-optimizer/config.json
 */

import Conf from 'conf';

let _config = null;

export function loadConfig() {
  if (_config) return _config;
  _config = new Conf({
    projectName: 'claude-smart-optimizer',
    defaults: {
      // Backend
      backend:            'claude',       // 'claude' or 'codex'

      // Input processing
      translate:          true,           // Auto-translate Hebrew → English
      stripPoliteness:    true,           // Remove "please", "thank you" etc.
      resolvePaths:       true,           // Resolve filenames to absolute paths
      trimLogs:           true,           // Trim long log pastes to 50 lines
      codeCompression:    true,           // Strip comments from code blocks
      secretScanner:      true,           // Warn if API key / password detected
      gitContext:         true,           // Auto-inject git diff when relevant

      // Intelligence
      smartRouting:       true,           // Auto-select model by query complexity

      // Memory & history
      memoryEnabled:      true,           // Cross-session project memory
      promptHistory:      true,           // Save all prompts to history file

      // Handoff triggers
      costThreshold:      0.80,           // USD — auto-handoff above this
      commandThreshold:   25,             // Number of prompts — auto-handoff
      timeThresholdHours: 2,              // Hours — auto-handoff

      // Time guard
      timeGuard:          true,
      timezone:           'Asia/Jerusalem',

      // Tool adapters
      adapters: {
        claudeCode: true,
        codex:      false,
        cursor:     false,
        vscode:     false,
      },
    },
  });
  return _config;
}
