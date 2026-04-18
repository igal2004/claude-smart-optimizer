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

function parseBoolean(value, fallback) {
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('');
  console.log(c.cyan(c.bold('  ── הגדרות CCSO ─────────────────────────')));
  console.log('  (לחץ Enter לשמור את הערך הנוכחי)\n');

  const backend = await ask(rl, 'פקודת Backend (Claude מומלץ)', config.get('backend'));
  config.set('backend', backend);

  console.log(c.bold('\n  חיסכון ודיוק:\n'));
  for (const [key, label] of [
    ['smartRouting', 'ניתוב מודל חכם (true/false)'],
    ['stripPoliteness', 'הסרת נימוסים (true/false)'],
    ['resolvePaths', 'המרת נתיבים מוחלטים (true/false)'],
    ['trimLogs', 'קיצוץ לוגים ארוכים (true/false)'],
    ['secretScanner', 'סורק סודות / API keys (true/false)'],
    ['gitContext', 'הקשר Git אוטומטי (true/false)'],
  ]) {
    const answer = await ask(rl, label, config.get(key));
    config.set(key, parseBoolean(answer, config.get(key)));
  }

  console.log(c.bold('\n  פיצ\'רים lossy / אופציונליים:\n'));
  for (const [key, label] of [
    ['translate', 'תרגום עברית לאנגלית (true/false)'],
    ['codeCompression', 'כיווץ קוד אוטומטי (true/false)'],
    ['truncateLargePastes', 'חיתוך קבצים גדולים (true/false)'],
    ['dedupeLongInput', 'הסרת תוכן כפול (true/false)'],
    ['responseLengthHints', 'הגבלת אורך תגובה (true/false)'],
  ]) {
    const answer = await ask(rl, label, config.get(key));
    config.set(key, parseBoolean(answer, config.get(key)));
  }

  console.log(c.bold('\n  ניהול סשן:\n'));
  for (const [key, label] of [
    ['memoryEnabled', 'זיכרון חוצה-סשן (true/false)'],
    ['promptHistory', 'שמירת היסטוריית פרומפטים (true/false)'],
    ['timeGuard', 'אזהרת שעות עומס (true/false)'],
  ]) {
    const answer = await ask(rl, label, config.get(key));
    config.set(key, parseBoolean(answer, config.get(key)));
  }

  const costThreshold = await ask(rl, 'סף עלות ל-Handoff אוטומטי (USD)', config.get('costThreshold'));
  config.set('costThreshold', parseFloat(costThreshold));

  const cmdThreshold = await ask(rl, 'סף פקודות ל-Handoff אוטומטי', config.get('commandThreshold'));
  config.set('commandThreshold', parseInt(cmdThreshold));

  rl.close();

  console.log('');
  console.log(c.green('  ✅ ההגדרות נשמרו בהצלחה!'));
  console.log(c.dim(`  קובץ: ${config.path}`));
  console.log(c.dim('  טיפ: lossy features כמו translate/codeCompression/output hints עדיף להדליק רק כשבאמת צריך.'));
  console.log('');
}

main().catch(console.error);
