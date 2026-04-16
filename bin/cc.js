#!/usr/bin/env node

/**
 * cc — CCSO Smart Optimizer v3.0
 * Main entry point. Works with Claude Code, Codex CLI, Cursor, Windsurf and more.
 *
 * Usage:
 *   cc                        — start the Smart REPL (Claude Code / Codex)
 *   cc --init                 — Smart Init wizard (CLAUDE.md, AGENTS.md, .claudeignore)
 *   cc --dashboard            — open the visual dashboard in browser
 *   cc --config               — interactive settings menu
 *   cc --status               — show current session status
 *   cc --uninstall            — remove CCSO from this machine
 *   cc mcp list               — list available MCP integrations
 *   cc mcp add <name>         — add an MCP integration (github, notion, etc.)
 *   cc mcp remove <name>      — remove an MCP integration
 *   cc mcp status             — show active MCPs per tool
 *   cc notebooklm login       — connect to Google NotebookLM
 *   cc notebooklm list        — list your notebooks
 *   cc notebooklm ask <q>     — query a notebook
 *   cc notebooklm save <text> — save a note to NotebookLM
 *   cc notebooklm status      — check connection status
 *   cc help                   — show this help
 */

import { fileURLToPath } from 'url';
import * as path from 'path';

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
  console.log(`  ${c.green('cc')}                     פתח Smart REPL (Claude Code / Codex)`);
  console.log(`  ${c.green('cc --init')}              אשף הגדרת פרויקט (CLAUDE.md + .claudeignore)`);
  console.log(`  ${c.green('cc --dashboard')}         פתח דשבורד ויזואלי בדפדפן`);
  console.log(`  ${c.green('cc --config')}            תפריט הגדרות`);
  console.log(`  ${c.green('cc --status')}            סטטוס סשן נוכחי`);
  console.log(`  ${c.green('cc --uninstall')}         הסר CCSO`);
  console.log('');
  console.log(c.bold('  חיסכון בכל הפלטפורמות:'));
  console.log(`  ${c.green('cc inject')}              הזרק כללי חיסכון לפרויקט (CLAUDE.md, .cursorrules, Copilot, Windsurf)`);
  console.log(`  ${c.green('cc inject /path')}        הזרק לתיקייה ספציפית`);
  console.log(`  ${c.green('cc eject')}               הסר כללי CCSO מהפרויקט`);
  console.log('');
  console.log(c.bold('  ניהול MCP (חיבורים חיצוניים):'));
  console.log(`  ${c.green('cc mcp list')}            רשימת כל ה-MCPs הזמינים`);
  console.log(`  ${c.green('cc mcp add github')}      הוסף חיבור ל-GitHub`);
  console.log(`  ${c.green('cc mcp add notion')}      הוסף חיבור ל-Notion`);
  console.log(`  ${c.green('cc mcp add memory')}      הוסף זיכרון מתמיד בין סשנים`);
  console.log(`  ${c.green('cc mcp remove <name>')}   הסר חיבור`);
  console.log(`  ${c.green('cc mcp status')}          הצג MCPs פעילים לפי כלי`);
  console.log('');
  console.log(c.bold('  NotebookLM Bridge (זיכרון חינמי לקבצי ענק):'));
  console.log(`  ${c.green('cc notebooklm login')}    התחבר לגוגל (פעם אחת)`);
  console.log(`  ${c.green('cc notebooklm list')}     הצג מחברות`);
  console.log(`  ${c.green('cc notebooklm ask "?"')}  שאל שאלה על המחברת`);
  console.log(`  ${c.green('cc notebooklm save "."')} שמור סיכום למחברת`);
  console.log('');
  console.log(c.dim('  כלים נתמכים: Claude Code, Codex CLI, Cursor, Windsurf'));
  console.log(c.dim('  GitHub: https://github.com/igal2004/ccso'));
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
  const { detectInstalledTools } = await import(path.join(__dirname, '..', 'src', 'adapters', 'tool-adapter.js'));

  const config  = loadConfig();
  const monitor = new ContextMonitor(config);
  const s       = monitor.getStatus();
  const tools   = detectInstalledTools();

  const c = { cyan: s => `\x1b[36m${s}\x1b[0m`, bold: s => `\x1b[1m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m`, green: s => `\x1b[32m${s}\x1b[0m` };
  console.log('');
  console.log(c.bold(c.cyan('  CCSO v3.0 — סטטוס\n')));
  console.log(`  כלים שזוהו:       ${tools.join(', ')}`);
  console.log(`  Backend פעיל:     ${config.get('backend') || 'claude'}`);
  console.log(`  סף עלות:          $${s.costThreshold}`);
  console.log(`  סף פקודות:        ${s.commandThreshold}`);
  console.log(`  תרגום עברית:      ${config.get('translate') !== false ? c.green('פעיל') : 'כבוי'}`);
  console.log(`  דשבורד:           cc --dashboard`);
  console.log('');
  process.exit(0);
}

if (cmd === '--dashboard') {
  const { spawn } = await import('child_process');
  const serverPath = path.join(__dirname, '..', 'src', 'dashboard', 'server.js');
  const url = 'http://localhost:3847';

  console.log('\n  [CCSO] פותח דשבורד...');
  console.log('  לעצירה: Ctrl+C\n');

  const server = spawn(process.execPath, [serverPath], { stdio: 'inherit' });

  setTimeout(() => {
    const opener = process.platform === 'darwin' ? 'open'
                 : process.platform === 'win32'  ? 'start'
                 : 'xdg-open';
    spawn(opener, [url], { detached: true, stdio: 'ignore' }).unref();
  }, 1200);

  server.on('close', () => process.exit(0));
  // Keep the parent alive — the server.on('close') handler will exit when server stops
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
  console.log(c.bold('  כל כלי AI בפרויקט זה יעבוד עם כללי החיסכון אוטומטית.'));
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
