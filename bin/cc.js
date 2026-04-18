#!/usr/bin/env node

/**
 * ccso — CCSO Smart Optimizer v3.0
 * Main entry point. Best with Claude Code; also manages project rules,
 * instruction files, MCP config, and companion bridges for other tools.
 *
 * Usage:
 *   ccso                        — start the Smart REPL (Claude Code backend)
 *   ccso --init                 — Smart Init wizard (CLAUDE.md, AGENTS.md, .claudeignore)
 *   ccso --dashboard            — open the visual dashboard in browser
 *   ccso --share-dashboard      — expose the live local dashboard via a public tunnel
 *   ccso --config               — interactive settings menu
 *   ccso --status               — show current session status
 *   ccso --uninstall            — remove CCSO from this machine
 *   ccso mcp list               — list available MCP integrations
 *   ccso mcp add <name>         — add an MCP integration (github, notion, etc.)
 *   ccso mcp remove <name>      — remove an MCP integration
 *   ccso mcp status             — show active MCPs per tool
 *   ccso notebooklm login       — connect to Google NotebookLM
 *   ccso notebooklm list        — list your notebooks
 *   ccso notebooklm ask <q>     — query a notebook
 *   ccso notebooklm save <text> — save a note to NotebookLM
 *   ccso notebooklm status      — check connection status
 *   ccso help                   — show this help
 */

import { fileURLToPath } from 'url';
import * as path from 'path';
import { ensureDashboardServer, openDashboardBrowser } from '../src/dashboard/control.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const cmd  = args[0];

// ── Help ──────────────────────────────────────────────────────────────────────

function showHelp() {
  const c = {
    cyan:  s => `\x1b[36m${s}\x1b[0m`,
    bold:  s => `\x1b[1m${s}\x1b[0m`,
    dim:   s => `\x1b[2m${s}\x1b[0m`,
    green: s => `\x1b[32m${s}\x1b[0m`,
  };

  console.log('');
  console.log(c.cyan(c.bold('  ╔═══════════════════════════════════════════════╗')));
  console.log(c.cyan(c.bold('  ║   CCSO — Claude Code Smart Optimizer v3.0    ║')));
  console.log(c.cyan(c.bold('  ╚═══════════════════════════════════════════════╝')));
  console.log('');
  console.log(c.bold('  פקודות בסיסיות:'));
  console.log(`  ${c.green('ccso')}                   פתח Smart REPL (Claude Code backend)`);
  console.log(`  ${c.green('ccso --init')}            אשף הגדרת פרויקט (CLAUDE.md + .claudeignore)`);
  console.log(`  ${c.green('ccso --dashboard')}       פתח דשבורד ויזואלי בדפדפן`);
  console.log(`  ${c.green('ccso --share-dashboard')} שתף את הדשבורד החי דרך לינק ציבורי`);
  console.log(`  ${c.green('ccso --config')}          תפריט הגדרות`);
  console.log(`  ${c.green('ccso --status')}          סטטוס סשן נוכחי`);
  console.log(`  ${c.green('ccso --uninstall')}       הסר CCSO`);
  console.log('');
  console.log(c.bold('  אינטגרציות פרויקט לכלים נתמכים:'));
  console.log(`  ${c.green('ccso inject')}            כתוב קובצי חוקים/הוראות ל-Claude/Cursor/Windsurf/Copilot/Gemini/Firebase`);
  console.log(`  ${c.green('ccso inject /path')}      הזרק לתיקייה ספציפית`);
  console.log(`  ${c.green('ccso eject')}             הסר כללי CCSO מהפרויקט`);
  console.log('');
  console.log(c.bold('  ניהול MCP (חיבורים חיצוניים):'));
  console.log(`  ${c.green('ccso mcp list')}          רשימת כל ה-MCPs הזמינים`);
  console.log(`  ${c.green('ccso mcp add github')}    הוסף חיבור ל-GitHub`);
  console.log(`  ${c.green('ccso mcp add notion')}    הוסף חיבור ל-Notion`);
  console.log(`  ${c.green('ccso mcp add memory')}    הוסף זיכרון מתמיד בין סשנים`);
  console.log(`  ${c.green('ccso mcp remove <name>')} הסר חיבור`);
  console.log(`  ${c.green('ccso mcp status')}        הצג MCPs פעילים לפי כלי`);
  console.log('');
  console.log(c.bold('  NotebookLM Bridge (זיכרון חינמי לקבצי ענק):'));
  console.log(`  ${c.green('ccso notebooklm login')}  התחבר לגוגל (פעם אחת)`);
  console.log(`  ${c.green('ccso notebooklm list')}   הצג מחברות`);
  console.log(`  ${c.green('ccso notebooklm ask "?"')} שאל שאלה על המחברת`);
  console.log(`  ${c.green('ccso notebooklm save "."')} שמור סיכום למחברת`);
  console.log('');
  console.log(c.dim('  אינטגרציות פעילות: Claude Code backend, Cursor/Windsurf rules, Copilot/Gemini instructions, NotebookLM bridge'));
  console.log(c.dim('  GitHub: https://github.com/igal2004/claude-smart-optimizer'));
  console.log('');
}

// ── Route commands ────────────────────────────────────────────────────────────

if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
  showHelp();
  process.exit(0);
}

if (cmd === '--uninstall') {
  await import(path.join(__dirname, 'uninstall.js'));
  process.exit(0);
}

if (cmd === '--init') {
  await import(path.join(__dirname, 'init.js'));
  process.exit(0);
}

if (cmd === '--config') {
  await import(path.join(__dirname, '..', 'scripts', 'configure.js'));
  process.exit(0);
}

if (cmd === '--status') {
  const { loadConfig }     = await import(path.join(__dirname, '..', 'src', 'core', 'config.js'));
  const { ContextMonitor } = await import(path.join(__dirname, '..', 'src', 'core', 'context-monitor.js'));
  const { getSupportedPlatformStatuses } = await import(path.join(__dirname, '..', 'src', 'core', 'platform-support.js'));

  const config  = loadConfig();
  const monitor = new ContextMonitor(config);
  const s       = monitor.getStatus();
  const tools   = (await getSupportedPlatformStatuses())
    .filter(tool => tool.availability === 'detected')
    .map(tool => tool.name);

  const c = { cyan: s => `\x1b[36m${s}\x1b[0m`, bold: s => `\x1b[1m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m`, green: s => `\x1b[32m${s}\x1b[0m` };
  console.log('');
  console.log(c.bold(c.cyan('  CCSO v3.0 — סטטוס\n')));
  console.log(`  פלטפורמות נתמכות שזוהו: ${tools.length ? tools.join(', ') : '—'}`);
  console.log(`  Backend פעיל:     ${config.get('backend') || 'claude'}`);
  console.log(`  סף עלות:          $${s.costThreshold}`);
  console.log(`  סף פקודות:        ${s.commandThreshold}`);
  console.log(`  תרגום עברית:      ${config.get('translate') !== false ? c.green('פעיל') : 'כבוי'}`);
  console.log(`  דשבורד:           ccso --dashboard`);
  console.log('');
  process.exit(0);
}

if (cmd === '--dashboard') {
  console.log('\n  [CCSO] פותח דשבורד...');
  console.log('  לעצירה: Ctrl+C\n');
  const { url, ready, alreadyRunning, child } = await ensureDashboardServer({ attached: true });
  if (!ready) {
    console.log('  ❌ לא הצלחתי להרים את שרת הדשבורד.\n');
    process.exit(1);
  }

  openDashboardBrowser(url);

  if (alreadyRunning || !child) {
    console.log(`  ✅ הדשבורד כבר זמין ב-${url}\n`);
    process.exit(0);
  }

  child.on('close', () => process.exit(0));
  // Keep the parent alive — the child.on('close') handler will exit when server stops.
}

if (cmd === '--share-dashboard') {
  const { shareDashboard } = await import(path.join(__dirname, '..', 'src', 'dashboard', 'share.js'));
  await shareDashboard();
  await new Promise(() => {});
}

if (cmd === 'mcp') {
  await import(path.join(__dirname, 'mcp.js'));
  process.exit(0);
}

if (cmd === 'notebooklm') {
  await import(path.join(__dirname, 'notebooklm.js'));
  process.exit(0);
}

if (cmd === 'template') {
  const { printTemplateList, getTemplate } = await import(path.join(__dirname, '..', 'src', 'core', 'templates.js'));
  const name = args[1];
  if (!name) { printTemplateList(); }
  else {
    const t = getTemplate(name);
    if (!t) { console.log(`\n  ❌ תבנית "${name}" לא נמצאה.\n`); printTemplateList(); }
    else { console.log(`\n  ${t.emoji} ${t.name}\n${'─'.repeat(50)}\n${t.text}\n`); }
  }
  process.exit(0);
}

if (cmd === 'history') {
  const { PromptHistory } = await import(path.join(__dirname, '..', 'src', 'core', 'prompt-history.js'));
  const h = new PromptHistory();
  const query = args.slice(1).join(' ');
  if (query) {
    const results = h.search(query);
    if (!results.length) console.log(`\n  לא נמצאו תוצאות עבור: "${query}"\n`);
    else console.log('\n' + results.map((e, i) => `  ${i+1}. ${e.text}`).join('\n') + '\n');
  } else {
    console.log(h.print(30));
  }
  process.exit(0);
}

if (cmd === 'inject' || cmd === '--inject') {
  const { injectAll } = await import(path.join(__dirname, '..', 'src', 'core', 'inject.js'));
  const c = { green: s => `\x1b[32m${s}\x1b[0m`, cyan: s => `\x1b[36m${s}\x1b[0m`, bold: s => `\x1b[1m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m`, yellow: s => `\x1b[33m${s}\x1b[0m` };
  const dir = args[1] || process.cwd();
  console.log('');
  console.log(c.bold(c.cyan('  [CCSO] מזריק כללי חיסכון לכל הפלטפורמות...\n')));
  const results = await injectAll(dir);
  for (const r of results) {
    const icon = r.status === 'created' ? '✅' : r.status === 'updated' ? '🔄' : '➕';
    console.log(`  ${icon}  ${c.green(r.file.padEnd(42))} ${c.dim(r.note)}`);
  }
  console.log('');
  console.log(c.bold('  קובצי הפרויקט הנתמכים עודכנו לכלים ש-CCSO יודע לכתוב עבורם.'));
  console.log(c.dim('  זה לא נותן ל-CCSO שליטה או מדידה מלאה בתוך כל IDE.\n'));
  console.log(c.dim('  להסרה: ccso eject\n'));
  process.exit(0);
}

if (cmd === 'eject' || cmd === '--eject') {
  const { ejectAll } = await import(path.join(__dirname, '..', 'src', 'core', 'inject.js'));
  const c = { yellow: s => `\x1b[33m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m`, bold: s => `\x1b[1m${s}\x1b[0m` };
  const dir = args[1] || process.cwd();
  const removed = ejectAll(dir);
  console.log('');
  if (removed.length) {
    removed.forEach(f => console.log(`  🗑️  הוסר מ: ${f}`));
  } else {
    console.log(c.dim('  אין כללי CCSO להסרה בתיקייה הנוכחית.'));
  }
  console.log('');
  process.exit(0);
}

if (cmd === 'memory') {
  const { loadConfig }  = await import(path.join(__dirname, '..', 'src', 'core', 'config.js'));
  const { Memory }      = await import(path.join(__dirname, '..', 'src', 'core', 'memory.js'));
  const mem = new Memory(loadConfig());
  const sub = args[1];
  if (!sub || sub === 'list') {
    const list = mem.list();
    console.log(list ? `\n${list}\n` : '\n  אין זיכרון שמור.\n');
  } else if (sub === 'add') {
    const fact = args.slice(2).join(' ');
    if (!fact) { console.log('\n  שימוש: ccso memory add "עובדה"\n'); }
    else { mem.add(fact); console.log(`\n  ✅ נשמר: "${fact}"\n`); }
  } else if (sub === 'clear') {
    mem.clear(); console.log('\n  🗑️  זיכרון הפרויקט נמחק.\n');
  } else if (sub === 'global') {
    const fact = args.slice(2).join(' ');
    if (!fact) { console.log('\n  שימוש: ccso memory global "עובדה"\n'); }
    else { mem.add(fact, true); console.log(`\n  ✅ נשמר גלובלי: "${fact}"\n`); }
  }
  process.exit(0);
}

// ── Default: launch Smart REPL ────────────────────────────────────────────────
await import(path.join(__dirname, '..', 'src', 'index.js'));
