#!/usr/bin/env node

/**
 * Claude Code Smart Optimizer (CCSO)
 * Main REPL entry point.
 *
 * Built-in commands:
 *   /handoff              — save session summary and reset
 *   /status               — show cost, commands, time
 *   /history [search <q>] — show prompt history
 *   /memory [add|list|clear|global] — manage cross-session memory
 *   /template [name]      — show/use a prompt template
 *   /exit                 — exit CCSO
 */

import { spawn }       from 'child_process';
import * as readline   from 'readline';
import { Interceptor } from './core/interceptor.js';
import { ContextMonitor } from './core/context-monitor.js';
import { TimeGuard }   from './core/time-guard.js';
import { ModelRouter } from './core/model-router.js';
import { PromptCache } from './core/cache.js';
import { Memory }      from './core/memory.js';
import { PromptHistory } from './core/prompt-history.js';
import { handleTemplateCommand } from './core/templates.js';
import { loadConfig }  from './core/config.js';
import { printBanner, printStatus } from './ui/display.js';
import { countTokens } from './core/token-utils.js';

const config         = loadConfig();
const interceptor    = new Interceptor(config);
const contextMonitor = new ContextMonitor(config);
const timeGuard      = new TimeGuard(config);
const modelRouter    = new ModelRouter(config);
const promptCache    = new PromptCache(config);
const memory         = new Memory(config);
const history        = new PromptHistory(config);

async function main() {
  printBanner();

  const timeWarning = timeGuard.check();
  if (timeWarning) console.log(timeWarning);

  const initialMemCtx = memory.buildContextPrefix();
  if (initialMemCtx) {
    console.log('  \x1b[2m[CCSO] זיכרון פרויקט נטען אוטומטית\x1b[0m');
  }

  const backend = config.get('backend') || 'claude';

  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    prompt: '\ncc> ',
    historySize: 0, // we manage history ourselves
  });

  printStatus(contextMonitor);
  rl.prompt();

  rl.on('line', async (rawInput) => {
    const input = rawInput.trim();
    if (!input) { rl.prompt(); return; }

    // ── Built-in /commands ──────────────────────────────────────────────────

    if (input === '/exit' || input === '/quit') {
      contextMonitor.saveToLog(false);
      console.log('\n👋 Session saved. Goodbye!');
      process.exit(0);
    }

    if (input === '/handoff') {
      await runHandoff(backend);
      rl.prompt();
      return;
    }

    if (input === '/status') {
      printStatus(contextMonitor);
      rl.prompt();
      return;
    }

    if (input === '/dashboard') {
      openDashboard();
      rl.prompt();
      return;
    }

    if (input === '/cache clear') {
      const n = promptCache.clear();
      console.log(`\n  ✅ [CCSO] מטמון נוקה (${n} רשומות נמחקו)`);
      rl.prompt();
      return;
    }

    if (input === '/cache') {
      console.log(`\n  💾 [CCSO] מטמון: ${promptCache.size()} רשומות שמורות`);
      rl.prompt();
      return;
    }

    // History
    const histResult = history.handleCommand(input);
    if (histResult.handled) {
      console.log(histResult.message);
      rl.prompt();
      return;
    }

    // Memory
    const memResult = memory.handleCommand(input);
    if (memResult.handled) {
      console.log(memResult.message);
      rl.prompt();
      return;
    }

    // Templates
    const tplResult = handleTemplateCommand(input);
    if (tplResult.handled) {
      console.log(tplResult.message);
      if (tplResult.prompt) {
        console.log('\x1b[36m' + tplResult.prompt + '\x1b[0m');
        console.log('');
      }
      rl.prompt();
      return;
    }

    // ── Process & dispatch ──────────────────────────────────────────────────

    // Save to history
    history.add(input);

    // Process through interceptor pipeline
    const {
      text: processed,
      savings: savingsBreakdown,
    } = await interceptor.processWithStats(input);

    // Inject memory context
    const memCtx = memory.buildContextPrefix(processed);
    const finalPrompt = memCtx + processed;
    const promptTokens = countTokens(finalPrompt);

    // Smart model routing
    const route = modelRouter.route(processed);
    if (route.reason) {
      console.log(`\n  \x1b[2m[CCSO] ${route.reason}\x1b[0m`);
    }

    // Auto-handoff check
    if (contextMonitor.shouldHandoff()) {
      console.log('\n⚠️  [CCSO] סף הסשן הגיע. מריץ Auto-Handoff...');
      await runHandoff(backend);
    }

    // Check response cache
    const cached = promptCache.get(finalPrompt, route.model);
    if (cached) {
      const outputTokens = countTokens(cached.response);
      console.log(`\n  \x1b[2m[CCSO] 💾 תגובה מהמטמון (חסכנו ~${outputTokens + promptTokens} טוקנים)\x1b[0m`);
      process.stdout.write(cached.response + '\n');
      contextMonitor.trackCommand();
      contextMonitor.trackTurn({
        promptTokens,
        outputTokens,
        model: route.model,
        savingsBreakdown,
        cacheHit: true,
      });
      rl.prompt();
      return;
    }

    // Run backend
    runBackend(backend, finalPrompt, route.args, contextMonitor, promptTokens, route.model, savingsBreakdown, (response) => {
      promptCache.set(finalPrompt, response, route.model || 'sonnet');
    });
    rl.prompt();
  });

  rl.on('close', () => {
    contextMonitor.saveToLog(false);
    console.log('\n👋 Session saved. Goodbye!');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    contextMonitor.saveToLog(false);
    console.log('\n👋 Session saved.');
    process.exit(0);
  });
}

function runBackend(backend, prompt, modelArgs = [], monitor, promptTokens = 0, model = null, savingsBreakdown = [], onComplete = null) {
  const args = [...modelArgs, '--print', prompt];
  const child = spawn(backend, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  monitor.trackCommand();
  let fullResponse = '';

  child.stdout.on('data', (data) => {
    const str = data.toString();
    process.stdout.write(str);
    fullResponse += str;
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });

  child.on('close', () => {
    if (fullResponse.trim()) {
      monitor.trackTurn({
        promptTokens,
        outputTokens: countTokens(fullResponse),
        model,
        savingsBreakdown,
      });
    }
    if (onComplete && fullResponse.trim()) onComplete(fullResponse.trim());
  });

  child.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.error(`\n❌ [CCSO] Backend "${backend}" לא נמצא. האם הוא מותקן?`);
      console.error(`   הרץ: ccso --config  לשינוי ה-Backend.\n`);
    }
  });
}

async function runHandoff(backend) {
  console.log('\n📝 [CCSO] יוצר סיכום סשן...');
  const { execSync } = await import('child_process');
  try {
    const gitStatus = execSync('git status -s 2>/dev/null || echo "not a git repo"').toString().trim();
    const gitLog    = execSync('git log --oneline -n 3 2>/dev/null || echo ""').toString().trim();
    const prompt    = `Write a concise HANDOFF.md: 1) What was just completed, 2) Git status meaning, 3) Exact next step. Git: ${gitStatus}. Commits: ${gitLog}. Max 15 lines, be extremely concise.`;

    const child = spawn(backend, ['--print', prompt], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', d => { output += d.toString(); });
    child.on('close', async () => {
      const { default: fsModule } = await import('fs');
      fsModule.writeFileSync('HANDOFF.md', output);

      // Also save to memory
      memory.add(`Handoff: ${output.split('\n')[0]}`);

      contextMonitor.markHandoff();
      console.log('✅ [CCSO] HANDOFF.md נשמר. סשן חדש מוכן!\n');
    });
  } catch (e) {
    console.log('⚠️  [CCSO] לא הצלחתי ליצור handoff:', e.message);
  }
}

async function openDashboard() {
  const serverPath = new URL('./dashboard/server.js', import.meta.url).pathname;
  console.log('\n🌐 [CCSO] פותח דשבורד...');
  const child = spawn(process.execPath, [serverPath], {
    detached: true,
    stdio:    'ignore',
  });
  child.unref();
  setTimeout(() => {
    const url    = 'http://localhost:3847';
    const opener = process.platform === 'darwin' ? 'open'
                 : process.platform === 'win32'  ? 'start'
                 : 'xdg-open';
    spawn(opener, [url], { detached: true, stdio: 'ignore' }).unref();
    console.log(`  ✅ דשבורד: ${url}\n`);
  }, 1000);
}

main().catch(console.error);
