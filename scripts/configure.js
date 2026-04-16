#!/usr/bin/env node

/**
 * CCSO Interactive Configuration
 * Run with: cc --config
 */

import * as readline from 'readline';
import { loadConfig } from '../src/core/config.js';

const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

const config = loadConfig();

function ask(rl, question, current) {
  return new Promise(resolve =>
    rl.question(`  ${question} [${c.dim(String(current))}]: `, (ans) => resolve(ans.trim() || String(current)))
  );
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('');
  console.log(c.cyan(c.bold('  ── הגדרות CCSO ─────────────────────────')));
  console.log('  (לחץ Enter לשמור את הערך הנוכחי)\n');

  const backend = await ask(rl, 'Backend (claude/codex)', config.get('backend'));
  config.set('backend', backend);

  const translate = await ask(rl, 'תרגום עברית לאנגלית (true/false)', config.get('translate'));
  config.set('translate', translate === 'true');

  const strip = await ask(rl, 'הסרת נימוסים (true/false)', config.get('stripPoliteness'));
  config.set('stripPoliteness', strip === 'true');

  const paths = await ask(rl, 'המרת נתיבים מוחלטים (true/false)', config.get('resolvePaths'));
  config.set('resolvePaths', paths === 'true');

  const logs = await ask(rl, 'קיצוץ לוגים ארוכים (true/false)', config.get('trimLogs'));
  config.set('trimLogs', logs === 'true');

  const timeGuard = await ask(rl, 'אזהרת שעות עומס (true/false)', config.get('timeGuard'));
  config.set('timeGuard', timeGuard === 'true');

  const costThreshold = await ask(rl, 'סף עלות ל-Handoff אוטומטי (USD)', config.get('costThreshold'));
  config.set('costThreshold', parseFloat(costThreshold));

  const cmdThreshold = await ask(rl, 'סף פקודות ל-Handoff אוטומטי', config.get('commandThreshold'));
  config.set('commandThreshold', parseInt(cmdThreshold));

  rl.close();

  console.log('');
  console.log(c.green('  ✅ ההגדרות נשמרו בהצלחה!'));
  console.log(c.dim(`  קובץ: ${config.path}`));
  console.log('');
}

main().catch(console.error);
