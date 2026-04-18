#!/usr/bin/env node

/**
 * CCSO Smart Init Wizard
 * Generates CLAUDE.md (local + global) and .claudeignore automatically.
 * Run: ccso --init
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

const c = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
};

function ask(rl, question, defaultVal = '') {
  const hint = defaultVal ? c.dim(` [${defaultVal}]`) : '';
  return new Promise(resolve => {
    rl.question(`  ${question}${hint}: `, ans => {
      resolve(ans.trim() || defaultVal);
    });
  });
}

function askMulti(rl, question) {
  return new Promise(resolve => {
    rl.question(`  ${question} (הפרד בפסיקים): `, ans => {
      resolve(ans.trim());
    });
  });
}

async function main() {
  console.log('');
  console.log(c.cyan(c.bold('  ╔══════════════════════════════════════════╗')));
  console.log(c.cyan(c.bold('  ║   CCSO Smart Init — אשף הגדרת פרויקט    ║')));
  console.log(c.cyan(c.bold('  ╚══════════════════════════════════════════╝')));
  console.log('');
  console.log(c.dim('  יוצר קבצי CLAUDE.md ו-.claudeignore אוטומטית'));
  console.log(c.dim('  לחץ Enter לדלג על שאלה ולהשתמש בברירת המחדל\n'));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const cwd = process.cwd();
  const globalPath = path.join(os.homedir(), 'CLAUDE.md');
  const localPath  = path.join(cwd, 'CLAUDE.md');
  const ignorePath = path.join(cwd, '.claudeignore');

  // ── Step 1: Global CLAUDE.md ──────────────────────────────────────────────
  const hasGlobal = fs.existsSync(globalPath);
  let createGlobal = true;

  if (hasGlobal) {
    const ans = await ask(rl, `קובץ CLAUDE.md גלובלי כבר קיים. לדרוס? (y/N)`, 'n');
    createGlobal = ans.toLowerCase() === 'y';
  }

  if (createGlobal) {
    console.log('\n  ' + c.bold('📋 הגדרות גלובליות (חלות על כל הפרויקטים שלך)'));
    console.log(c.dim('  ─────────────────────────────────────────────\n'));

    const name       = await ask(rl, 'השם שלך (לדוגמה: "יגאל")', 'המשתמש');
    const level      = await ask(rl, 'רמת הניסיון שלך (1=מתחיל, 2=בינוני, 3=מקצועי)', '2');
    const os_pref    = await ask(rl, 'מערכת הפעלה', process.platform === 'darwin' ? 'Mac' : process.platform === 'win32' ? 'Windows' : 'Linux');
    const editor     = await ask(rl, 'עורך קוד מועדף', 'VS Code');
    const lang_code  = await ask(rl, 'שפת קוד מועדפת', 'JavaScript/TypeScript');
    const comm_lang  = await ask(rl, 'שפת תקשורת עם קלוד', 'עברית');
    const style      = await ask(rl, 'סגנון תשובות מועדף (קצר/מפורט)', 'קצר וממוקד');

    const levelMap = { '1': 'מתחיל — הסבר כל שלב בפירוט', '2': 'בינוני — הסבר החלטות מרכזיות', '3': 'מקצועי — קוד ישיר ללא הסברים מיותרים' };
    const levelText = levelMap[level] || levelMap['2'];

    const globalContent = `# הגדרות גלובליות — ${name}

## זהות המשתמש
- שם: ${name}
- רמת ניסיון: ${levelText}
- מערכת הפעלה: ${os_pref}
- עורך קוד: ${editor}

## סגנון עבודה
- תקשורת: ${comm_lang} (קוד תמיד באנגלית)
- שפת קוד מועדפת: ${lang_code}
- סגנון תשובות: ${style}
- לפני ביצוע — הסבר תמיד מה אתה עומד לעשות
- אל תשתמש בנימוסים מיותרים — ישיר לעניין
- אל תחזור על מה שכבר ידוע — המשך מאיפה שעצרנו

## כללי ברזל
- אל תסרוק קבצים שלא ביקשתי
- אל תשנה קבצים שלא ביקשתי לשנות
- אם אתה לא בטוח — שאל לפני שאתה מבצע
`;

    fs.writeFileSync(globalPath, globalContent);
    console.log(c.green(`\n  ✅ נוצר: ${globalPath}`));
  }

  // ── Step 2: Local CLAUDE.md ───────────────────────────────────────────────
  const hasLocal = fs.existsSync(localPath);
  let createLocal = true;

  if (hasLocal) {
    const ans = await ask(rl, `\nקובץ CLAUDE.md מקומי כבר קיים. לדרוס? (y/N)`, 'n');
    createLocal = ans.toLowerCase() === 'y';
  }

  if (createLocal) {
    console.log('\n  ' + c.bold('📁 הגדרות פרויקט (ספציפיות לתיקייה הנוכחית)'));
    console.log(c.dim('  ─────────────────────────────────────────────\n'));

    const projectName = await ask(rl, 'שם הפרויקט', path.basename(cwd));
    const description = await ask(rl, 'תיאור קצר של הפרויקט', 'פרויקט פיתוח');
    const tech        = await askMulti(rl, 'טכנולוגיות (לדוגמה: React, Node.js, PostgreSQL)');
    const decisions   = await ask(rl, 'החלטות עיצוב/ארכיטקטורה חשובות שכבר קיבלת', 'לא הוגדרו עדיין');
    const status      = await ask(rl, 'איפה עצרת / מה השלב הנוכחי', 'תחילת הפרויקט');
    const nextStep    = await ask(rl, 'מה הצעד הבא', 'להגדיר');
    const avoidFiles  = await askMulti(rl, 'קבצים/תיקיות שאסור לגעת בהם (לדוגמה: .env, config/prod)');

    const localContent = `# פרויקט: ${projectName}

## מה אנחנו בונים
${description}

## טכנולוגיות
${tech ? tech.split(',').map(t => `- ${t.trim()}`).join('\n') : '- לא הוגדרו עדיין'}

## החלטות שכבר קיבלנו
${decisions}

## סטטוס נוכחי
${status}

## הצעד הבא
${nextStep}

## אסור לגעת
${avoidFiles ? avoidFiles.split(',').map(f => `- ${f.trim()}`).join('\n') : '- .env\n- node_modules/'}

## היסטוריית סשנים
<!-- CCSO מעדכן אוטומטית בסוף כל סשן -->
`;

    fs.writeFileSync(localPath, localContent);
    console.log(c.green(`\n  ✅ נוצר: ${localPath}`));
  }

  // ── Step 3: .claudeignore ─────────────────────────────────────────────────
  const hasIgnore = fs.existsSync(ignorePath);
  let createIgnore = true;

  if (hasIgnore) {
    const ans = await ask(rl, `\n.claudeignore כבר קיים. לדרוס? (y/N)`, 'n');
    createIgnore = ans.toLowerCase() === 'y';
  }

  if (createIgnore) {
    // Detect project type to add relevant ignores
    const hasNodeModules = fs.existsSync(path.join(cwd, 'node_modules'));
    const hasPythonVenv  = fs.existsSync(path.join(cwd, 'venv')) || fs.existsSync(path.join(cwd, '.venv'));
    const hasGit         = fs.existsSync(path.join(cwd, '.git'));

    const ignoreContent = `# .claudeignore — קבצים שקלוד לא יסרוק
# נוצר אוטומטית על ידי CCSO Smart Init

# ספריות חיצוניות (חוסכות המון טוקנים!)
node_modules/
${hasPythonVenv ? 'venv/\n.venv/' : '# venv/'}
vendor/
bower_components/

# קבצי Build
dist/
build/
.next/
.nuxt/
out/
coverage/

# קבצי מערכת
${hasGit ? '.git/' : '# .git/'}
.DS_Store
*.log
*.lock
package-lock.json
yarn.lock
pnpm-lock.yaml

# קבצים רגישים
.env
.env.*
*.pem
*.key
secrets/
credentials/

# קבצי מדיה גדולים
*.mp4
*.mp3
*.zip
*.tar.gz
*.png
*.jpg
*.gif
`;

    fs.writeFileSync(ignorePath, ignoreContent);
    console.log(c.green(`  ✅ נוצר: ${ignorePath}`));
    if (hasNodeModules) {
      console.log(c.yellow(`  ⚡ node_modules נחסמה — חיסכון עצום בטוקנים!`));
    }
  }

  rl.close();

  console.log('');
  console.log(c.bold(c.green('  🎉 הפרויקט מוכן! קלוד יקרא את ההקשר אוטומטית בכל סשן.')));
  console.log('');
  console.log(c.dim('  טיפ: בסוף כל סשן הקלד /handoff כדי שקלוד יעדכן את CLAUDE.md אוטומטית.'));
  console.log('');
}

main().catch(console.error);
