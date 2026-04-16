#!/usr/bin/env node

/**
 * CCSO Uninstaller
 * Cleanly removes all traces of the Smart Optimizer from the system.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log('');
  console.log(c.yellow(c.bold('  ╔══════════════════════════════════════╗')));
  console.log(c.yellow(c.bold('  ║   CCSO Uninstaller                   ║')));
  console.log(c.yellow(c.bold('  ╚══════════════════════════════════════╝')));
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const confirm = await ask(rl, '  האם אתה בטוח שברצונך להסיר את CCSO? (y/N): ');
  if (confirm.trim().toLowerCase() !== 'y') {
    console.log('\n  ביטול. לא בוצע שינוי.\n');
    rl.close();
    return;
  }

  console.log('\n  🗑️  מסיר...\n');

  // 1. Remove alias from shell profile
  const shellrc = path.join(os.homedir(), process.env.SHELL?.includes('zsh') ? '.zshrc' : '.bashrc');
  if (fs.existsSync(shellrc)) {
    let content = fs.readFileSync(shellrc, 'utf8');
    if (content.includes('CCSO')) {
      // Remove the CCSO block
      content = content.replace(/\n# Claude Code Smart Optimizer \(CCSO\)\nexport CCSO_BACKEND=.*\nalias cc=.*\n/g, '');
      fs.writeFileSync(shellrc, content);
      console.log(c.green(`  ✅ Alias הוסר מ-${shellrc}`));
    }
  }

  // 2. Ask about config files
  const configDir = path.join(os.homedir(), '.config', 'claude-smart-optimizer');
  if (fs.existsSync(configDir)) {
    const delConfig = await ask(rl, '  האם למחוק גם את קובץ ההגדרות שלך? (y/N): ');
    if (delConfig.trim().toLowerCase() === 'y') {
      fs.rmSync(configDir, { recursive: true, force: true });
      console.log(c.green('  ✅ קובץ הגדרות נמחק'));
    } else {
      console.log(c.dim('  ℹ️  קובץ הגדרות נשמר (ניתן למחוק ידנית מ: ' + configDir + ')'));
    }
  }

  // 3. Note about HANDOFF.md files
  console.log(c.dim('\n  ℹ️  קבצי HANDOFF.md בתיקיות הפרויקטים שלך לא נמחקו — הם שייכים לפרויקטים.'));

  rl.close();

  console.log('');
  console.log(c.bold(c.green('  ✅ CCSO הוסר בהצלחה.')));
  console.log(c.dim('  Claude Code ממשיך לעבוד כרגיל עם הפקודה "claude".'));
  console.log('');
  console.log('  כדי להפעיל מחדש, הרץ:');
  console.log(c.dim('    source ~/.bashrc'));
  console.log('');
}

main().catch(console.error);
