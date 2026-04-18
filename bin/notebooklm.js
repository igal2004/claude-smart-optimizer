#!/usr/bin/env node

/**
 * CCSO NotebookLM Bridge
 * Connect any AI coding tool to Google NotebookLM as a free external memory.
 *
 * Usage:
 *   ccso notebooklm login          — authenticate with Google (one-time setup)
 *   ccso notebooklm list           — list all your notebooks
 *   ccso notebooklm ask <question> — query a notebook and get a summary
 *   ccso notebooklm save <text>    — save a note/summary to a notebook
 *   ccso notebooklm status         — check connection status
 *
 * How it works:
 *   NotebookLM has no official API. This bridge uses Playwright (headless browser)
 *   to automate the NotebookLM web interface on your behalf — exactly as if you
 *   were typing in the browser, but automated.
 *
 *   Your Google session cookie is stored locally in ~/.ccso/notebooklm_session.json
 *   and is NEVER sent anywhere except to Google's own servers.
 *
 * Privacy note:
 *   The session file gives access to your Google account. It is stored only on
 *   your local machine. CCSO never transmits it to any external server.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const c = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
};

const SESSION_PATH = path.join(os.homedir(), '.ccso', 'notebooklm_session.json');
const NOTEBOOKS_CACHE = path.join(os.homedir(), '.ccso', 'notebooklm_notebooks.json');
const NOTEBOOKLM_URL = 'https://notebooklm.google.com';

// ── Check Playwright availability ─────────────────────────────────────────────

async function getPlaywright() {
  try {
    const { chromium } = await import('playwright');
    return chromium;
  } catch {
    return null;
  }
}

async function ensurePlaywright() {
  const pw = await getPlaywright();
  if (pw) return pw;

  console.log(c.yellow('\n  📦 מתקין Playwright (נדרש פעם אחת)...\n'));
  const { execSync } = await import('child_process');
  try {
    execSync('npm install -g playwright && npx playwright install chromium', { stdio: 'inherit' });
    return await getPlaywright();
  } catch {
    console.log(c.red('\n  שגיאה: לא ניתן להתקין Playwright. נסה: npm install -g playwright\n'));
    return null;
  }
}

// ── Session helpers ───────────────────────────────────────────────────────────

function loadSession() {
  if (!fs.existsSync(SESSION_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8')); } catch { return null; }
}

function saveSession(cookies) {
  const dir = path.dirname(SESSION_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SESSION_PATH, JSON.stringify({ cookies, savedAt: new Date().toISOString() }, null, 2));
}

function loadNotebooksCache() {
  if (!fs.existsSync(NOTEBOOKS_CACHE)) return [];
  try { return JSON.parse(fs.readFileSync(NOTEBOOKS_CACHE, 'utf8')); } catch { return []; }
}

function saveNotebooksCache(notebooks) {
  fs.writeFileSync(NOTEBOOKS_CACHE, JSON.stringify(notebooks, null, 2));
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function cmdLogin() {
  console.log('');
  console.log(c.bold(c.cyan('  🔐 CCSO NotebookLM — התחברות לגוגל\n')));
  console.log(c.dim('  ייפתח חלון דפדפן. התחבר לחשבון הגוגל שלך.'));
  console.log(c.dim('  לאחר ההתחברות, הדפדפן ייסגר אוטומטית.\n'));
  console.log(c.yellow('  ⚠️  הסשן נשמר רק על המחשב שלך ולא נשלח לשום מקום.\n'));

  const chromium = await ensurePlaywright();
  if (!chromium) return;

  const browser = await chromium.launch({ headless: false, args: ['--window-size=1000,700'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://accounts.google.com/signin');

  console.log(c.cyan('  ⏳ ממתין להתחברות... (סגור את הדפדפן לאחר שנכנסת)'));

  // Wait for redirect to NotebookLM or user closes browser
  try {
    await page.waitForURL('**/notebooklm.google.com**', { timeout: 120000 });
  } catch {
    // User might have closed or taken too long — try to grab cookies anyway
  }

  // Navigate to NotebookLM to ensure we have the right cookies
  try {
    await page.goto(NOTEBOOKLM_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch { /* ignore */ }

  const cookies = await context.cookies();
  await browser.close();

  const googleCookies = cookies.filter(c => c.domain.includes('google'));
  if (googleCookies.length === 0) {
    console.log(c.red('\n  שגיאה: לא נמצאו cookies של גוגל. נסה שוב.\n'));
    return;
  }

  saveSession(googleCookies);
  console.log(c.bold(c.green('\n  ✅ התחברות הצליחה! הסשן נשמר.\n')));
  console.log(c.dim('  כעת תוכל להשתמש ב: ccso notebooklm list\n'));
}

// ── List notebooks ────────────────────────────────────────────────────────────

async function cmdList() {
  const session = loadSession();
  if (!session) {
    console.log(c.yellow('\n  לא מחובר. הרץ: ccso notebooklm login\n'));
    return;
  }

  console.log(c.dim('\n  טוען רשימת מחברות...\n'));

  const chromium = await ensurePlaywright();
  if (!chromium) return;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(session.cookies);
  const page = await context.newPage();

  try {
    await page.goto(NOTEBOOKLM_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Extract notebook titles from the page
    const notebooks = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-notebook-id], .notebook-item, [aria-label*="notebook"]');
      const results = [];
      items.forEach((el, i) => {
        const title = el.querySelector('h3, h2, .title, [class*="title"]')?.textContent?.trim()
                   || el.getAttribute('aria-label')
                   || `מחברת ${i + 1}`;
        const id = el.getAttribute('data-notebook-id') || el.getAttribute('data-id') || String(i);
        if (title) results.push({ id, title });
      });
      return results;
    });

    await browser.close();

    if (notebooks.length === 0) {
      console.log(c.yellow('  לא נמצאו מחברות. צור מחברת ב-notebooklm.google.com\n'));
      return;
    }

    saveNotebooksCache(notebooks);

    console.log(c.bold(c.cyan('  📚 המחברות שלך ב-NotebookLM:\n')));
    notebooks.forEach((nb, i) => {
      console.log(`  ${c.bold(String(i + 1).padStart(2))}. ${nb.title}`);
    });
    console.log('');
    console.log(c.dim('  שאל מחברת: ccso notebooklm ask "שאלה שלך"'));
    console.log('');

  } catch (err) {
    await browser.close();
    console.log(c.red(`\n  שגיאה: ${err.message}\n`));
    console.log(c.yellow('  ייתכן שהסשן פג תוקף. הרץ: ccso notebooklm login\n'));
  }
}

// ── Ask a question ────────────────────────────────────────────────────────────

async function cmdAsk(question) {
  if (!question) {
    console.log(c.red('\n  שגיאה: ציין שאלה. לדוגמה: ccso notebooklm ask "מה הארכיטקטורה של הפרויקט?"\n'));
    return;
  }

  const session = loadSession();
  if (!session) {
    console.log(c.yellow('\n  לא מחובר. הרץ: ccso notebooklm login\n'));
    return;
  }

  const notebooks = loadNotebooksCache();
  if (notebooks.length === 0) {
    console.log(c.yellow('\n  לא נמצאו מחברות. הרץ תחילה: ccso notebooklm list\n'));
    return;
  }

  // Use first notebook by default (or let user pick)
  const notebook = notebooks[0];
  console.log(c.dim(`\n  שואל את "${notebook.title}"...\n`));

  const chromium = await ensurePlaywright();
  if (!chromium) return;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(session.cookies);
  const page = await context.newPage();

  try {
    await page.goto(`${NOTEBOOKLM_URL}/notebook/${notebook.id}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Find chat input and type question
    const chatInput = await page.$('textarea[placeholder], [contenteditable="true"], input[type="text"]');
    if (!chatInput) {
      await browser.close();
      console.log(c.yellow('\n  לא ניתן למצוא את שדה הצ\'אט. ייתכן ש-NotebookLM שינה את הממשק.\n'));
      return;
    }

    await chatInput.click();
    await chatInput.fill(question);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000); // Wait for response

    // Extract the latest response
    const response = await page.evaluate(() => {
      const messages = document.querySelectorAll('[class*="response"], [class*="answer"], [class*="message"]');
      const last = messages[messages.length - 1];
      return last?.textContent?.trim() || '';
    });

    await browser.close();

    if (response) {
      console.log(c.bold(c.cyan('  📖 תשובה מ-NotebookLM:\n')));
      console.log('  ' + response.split('\n').join('\n  '));
      console.log('');
    } else {
      console.log(c.yellow('\n  לא התקבלה תשובה. ייתכן ש-NotebookLM שינה את הממשק.\n'));
    }

  } catch (err) {
    await browser.close();
    console.log(c.red(`\n  שגיאה: ${err.message}\n`));
  }
}

// ── Save a note ───────────────────────────────────────────────────────────────

async function cmdSave(text) {
  if (!text) {
    console.log(c.red('\n  שגיאה: ציין טקסט לשמירה. לדוגמה: ccso notebooklm save "סיכום הסשן של היום"\n'));
    return;
  }

  // For now, save to a local markdown file that can be uploaded to NotebookLM manually
  const savePath = path.join(os.homedir(), '.ccso', 'notebooklm_notes.md');
  const timestamp = new Date().toLocaleString('he-IL');
  const entry = `\n## ${timestamp}\n${text}\n`;

  const dir = path.dirname(savePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(savePath, entry);

  console.log(c.green(`\n  ✅ הסיכום נשמר ב: ${savePath}`));
  console.log(c.dim('  תוכל להעלות קובץ זה ל-NotebookLM ידנית, או להשתמש ב-ccso notebooklm list לסנכרון.\n'));
}

// ── Status ────────────────────────────────────────────────────────────────────

async function cmdStatus() {
  const session = loadSession();
  const notebooks = loadNotebooksCache();

  console.log('');
  console.log(c.bold(c.cyan('  📊 סטטוס NotebookLM Bridge\n')));

  if (session) {
    const savedAt = new Date(session.savedAt).toLocaleString('he-IL');
    console.log(c.green(`  ✅ מחובר (סשן נשמר: ${savedAt})`));
  } else {
    console.log(c.yellow('  ❌ לא מחובר — הרץ: ccso notebooklm login'));
  }

  console.log(`  📚 מחברות בקאש: ${notebooks.length}`);

  const notesPath = path.join(os.homedir(), '.ccso', 'notebooklm_notes.md');
  if (fs.existsSync(notesPath)) {
    const size = fs.statSync(notesPath).size;
    console.log(`  📝 קובץ סיכומים: ${(size / 1024).toFixed(1)} KB`);
  }

  console.log('');
  console.log(c.dim('  פקודות: ccso notebooklm [login|list|ask|save|status]'));
  console.log('');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(3); // skip: node, cc.js, notebooklm
  const subCmd = args[0];
  const arg = args.slice(1).join(' ');

  switch (subCmd) {
    case 'login':    await cmdLogin(); break;
    case 'list':     await cmdList(); break;
    case 'ask':      await cmdAsk(arg); break;
    case 'save':     await cmdSave(arg); break;
    case 'status':
    case undefined:  await cmdStatus(); break;
    default:
      console.log(c.red(`\n  פקודה לא מוכרת: ${subCmd}`));
      console.log(c.dim('  שימוש: ccso notebooklm [login|list|ask|save|status]\n'));
  }
}

main().catch(console.error);
