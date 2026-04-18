#!/usr/bin/env node

/**
 * CCSO Smart Installer
 * Auto-detects supported AI tools and saves a conservative default config.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { getCCSOPath } from '../src/core/storage-paths.js';
import { getDefaultConfig } from '../src/core/default-config.js';

const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
};

const SCRIPT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function detect(cmd) {
  try { execSync(`which ${cmd}`, { stdio: 'ignore' }); return true; } catch { return false; }
}

function detectCursor() {
  const dirs = [
    path.join(os.homedir(), '.cursor'),
    path.join(os.homedir(), 'Library', 'Application Support', 'Cursor'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor'),
  ];
  return dirs.some(d => fs.existsSync(d));
}

function detectVSCode() {
  const dirs = [
    path.join(os.homedir(), '.vscode'),
    path.join(os.homedir(), 'Library', 'Application Support', 'Code'),
  ];
  return dirs.some(d => fs.existsSync(d));
}

function detectExtension(prefixes = []) {
  const dirs = [
    path.join(os.homedir(), '.vscode', 'extensions'),
    path.join(os.homedir(), '.cursor', 'extensions'),
  ];

  return dirs.some((dir) => {
    if (!fs.existsSync(dir)) return false;
    return fs.readdirSync(dir).some((entry) => {
      const lower = entry.toLowerCase();
      return prefixes.some((prefix) => lower.startsWith(prefix.toLowerCase()));
    });
  });
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log('');
  console.log(c.cyan(c.bold('  ╔══════════════════════════════════════╗')));
  console.log(c.cyan(c.bold('  ║   CCSO Smart Installer               ║')));
  console.log(c.cyan(c.bold('  ╚══════════════════════════════════════╝')));
  console.log('');
  console.log('  🔍 סורק את המערכת שלך...\n');

  // Auto-detection
  const detected = {
    claudeCode: detect('claude'),
    cursor:     detectCursor(),
    windsurf:   detect('windsurf') || fs.existsSync('/Applications/Windsurf.app'),
    copilot:    detectExtension(['github.copilot', 'github.copilot-chat']),
    gemini:     detectExtension(['google.geminicodeassist', 'googlecloudtools.cloudcode', 'google.cloudcode']),
    firebaseStudio: false,
    notebooklm: false,
  };

  console.log(`  Claude Code:  ${detected.claudeCode ? c.green('✅ זוהה') : c.dim('❌ לא נמצא')}`);
  console.log(`  Cursor:       ${detected.cursor     ? c.green('✅ זוהה') : c.dim('❌ לא נמצא')}`);
  console.log(`  Windsurf:     ${detected.windsurf   ? c.green('✅ זוהה') : c.dim('❌ לא נמצא')}`);
  console.log(`  Copilot:      ${detected.copilot    ? c.green('✅ זוהה') : c.dim('❌ לא נמצא')}`);
  console.log(`  Gemini:       ${detected.gemini     ? c.green('✅ זוהה') : c.dim('❌ לא נמצא')}`);
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // Ask user to confirm or override
  console.log('  אנא אשר את האינטגרציות שברצונך להבליט ב-CCSO (y/n לכל אחת):\n');

  const choices = {};
  for (const [key, label] of [
    ['claudeCode', 'Claude Code (Full backend — מומלץ!)'],
    ['cursor', 'Cursor (Project rules + MCP)'],
    ['windsurf', 'Windsurf (Project rules + MCP)'],
    ['copilot', 'GitHub Copilot (instruction file only)'],
    ['gemini', 'Gemini Code Assist (instruction file only)'],
  ]) {
    const def = detected[key] ? 'y' : 'n';
    const ans = await ask(rl, `  ${label} [${def}]: `);
    choices[key] = (ans.trim().toLowerCase() || def) === 'y';
  }

  console.log('');
  console.log('  🔧 מתקין...\n');

  // Install alias in shell profile
  if (choices.claudeCode) {
    const backend = 'claude';
    const alias = `alias ccso='node ${path.join(SCRIPT_DIR, 'bin', 'cc.js')}'`;
    const configLine = `\n# Claude Code Smart Optimizer (CCSO)\nexport CCSO_BACKEND=${backend}\n${alias}\n`;

    const shellrc = path.join(os.homedir(), process.env.SHELL?.includes('zsh') ? '.zshrc' : '.bashrc');
    if (!fs.readFileSync(shellrc, 'utf8').includes('CCSO')) {
      fs.appendFileSync(shellrc, configLine);
      console.log(c.green(`  ✅ Alias "cc" נוסף ל-${shellrc}`));
    } else {
      console.log(c.yellow(`  ℹ️  Alias כבר קיים ב-${shellrc}`));
    }
  }

  // Ask about dashboard
  const dashAns = await ask(rl, '  האם להתקין גם את הדשבורד הויזואלי? (פותח בדפדפן עם cc --dashboard) [Y/n]: ');
  const installDashboard = (dashAns.trim().toLowerCase() || 'y') !== 'n';
  if (installDashboard) {
    console.log(c.green('  ✅ הדשבורד יהיה זמין דרך: cc --dashboard'));
  }
  console.log('');

  // Save config
  const configDir = path.dirname(getCCSOPath('config.json'));
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = getCCSOPath('config.json');
  const defaults = getDefaultConfig();
  const config = {
    ...defaults,
    backend: 'claude',
    adapters: {
      ...defaults.adapters,
      ...choices,
      firebaseStudio: true,
      notebooklm: true,
    },
    dashboard: installDashboard,
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(c.green(`  ✅ הגדרות נשמרו ב-${configPath}`));

  rl.close();

  console.log('');
  console.log(c.bold(c.green('  🎉 ההתקנה הושלמה בהצלחה!')));
  console.log('');
  console.log(c.dim('  ברירות המחדל שמרניות: translate/code compression/output hints כבויים עד שתדליק אותם ידנית.'));
  console.log('');
  console.log('  כדי להתחיל לעבוד, הרץ:');
  console.log(c.cyan('    source ~/.bashrc   # (או פתח טרמינל חדש)'));
  console.log(c.cyan('    cc                 # במקום "claude"'));
  if (installDashboard) {
    console.log(c.cyan('    cc --dashboard     # פתיחת דשבורד ויזואלי בדפדפן'));
  }
  console.log('');
  console.log('  להסרה:');
  console.log(c.dim('    node ' + path.join(SCRIPT_DIR, 'bin', 'uninstall.js')));
  console.log('');
}

main().catch(console.error);
