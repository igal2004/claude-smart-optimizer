/**
 * CCSO Basic Test Suite
 * Run: node tests/test.js
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccso-tests-'));
process.env.CCSO_HOME = testHome;

const { Interceptor } = await import('../src/core/interceptor.js');
const { ModelRouter } = await import('../src/core/model-router.js');
const { PromptCache } = await import('../src/core/cache.js');
const { Memory } = await import('../src/core/memory.js');
const { ContextMonitor } = await import('../src/core/context-monitor.js');
const { loadConfig } = await import('../src/core/config.js');
const { getCCSOPath } = await import('../src/core/storage-paths.js');
const { getFeatureCatalog } = await import('../src/core/feature-catalog.js');
const { getSupportedPlatformStatuses } = await import('../src/core/platform-support.js');
const { PromptBundler, handleBundleCommand } = await import('../src/core/prompt-bundler.js');
const { ProjectBriefs } = await import('../src/core/briefs.js');
const { extractTunnelUrl } = await import('../src/dashboard/share.js');

const cfg = { get: (k) => ({ gitContext: false, translate: false }[k]) };
let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.error(`  ❌ ${label}`); failed++; }
}

// ── ModelRouter ───────────────────────────────────────────────────────────────
console.log('\n── ModelRouter ──');
const router = new ModelRouter({ get: () => undefined });
assert('simple question → haiku',  router.route('what is React?').model === 'haiku');
assert('hebrew question → haiku',  router.route('מה זה useState?').model === 'haiku');
assert('complex → opus',           router.route('refactor the entire codebase for performance optimization').model === 'opus');
assert('security audit → opus',    router.route('security audit of the auth module').model === 'opus');
assert('implement feature → sonnet', router.route('implement a login feature with JWT tokens').model === 'sonnet');
assert('hi → haiku',               router.route('hi').model === 'haiku');
assert('fix typo → haiku',         router.route('fix typo in README').model === 'haiku');
assert('add feature → sonnet',     router.route('add a button to the form').model === 'sonnet');

// ── Interceptor ───────────────────────────────────────────────────────────────
console.log('\n── Interceptor ──');
const ix = new Interceptor(cfg);

const compressed = ix._compressCode('```js\n// comment\nconst x = 1;\nconsole.log(x);\n```');
assert('code compression removes comment',     !compressed.text.includes('// comment'));
assert('code compression removes console.log', !compressed.text.includes('console.log'));
assert('code compression saves chars',         compressed.saved > 0);

const deduped = ix._deduplicateContent(
  'fix the bug\nfix the bug\nthe problem is in the auth module\nthe problem is in the auth module\ncheck the logs\ncheck the logs\ncheck the logs\ncheck the logs\nfix the bug\ncheck the config',
);
assert('deduplication removes repeated lines', deduped.split('\n').length < 10);

const hint = ix._buildLengthHint('what is Node.js?');
assert('length hint for simple question', hint !== null);
assert('no length hint for long text', ix._buildLengthHint('explain in detail how the authentication flow works with refresh tokens and why we need them') === null);
const processedStats = await ix.processWithStats('please fix typo in README');
assert('processWithStats returns actions array', Array.isArray(processedStats.actions));

const longLog = [
  'Why does this crash? Here is the full server log:',
  ...Array.from({ length: 35 }, (_, i) => `[2024-03-15 08:${String(i).padStart(2, '0')}:00] INFO Heartbeat ${i}`),
  '[2024-03-15 08:40:12] ERROR TypeError: Cannot read properties of undefined (reading "id")',
  '    at OrderService.createOrder (/app/src/services/order.service.js:67:22)',
  '    at async OrderController.create (/app/src/controllers/order.controller.js:34:18)',
  ...Array.from({ length: 35 }, (_, i) => `[2024-03-15 08:${String(i).padStart(2, '0')}:30] INFO Noise tail ${i}`),
].join('\n');
const trimmedLog = ix._trimLog(longLog);
assert('log trimming keeps the main error', trimmedLog.includes('TypeError: Cannot read properties of undefined'));
assert('log trimming keeps stack context', trimmedLog.includes('OrderService.createOrder'));
assert('log trimming removes unrelated log noise', trimmedLog.split('\n').length < longLog.split('\n').length);

// ── Config ───────────────────────────────────────────────────────────────────
console.log('\n── Config ──');
const appConfig = loadConfig();
assert('config stored in CCSO_HOME during tests', appConfig.path === path.join(testHome, 'config.json'));
assert('translate is disabled by default', appConfig.get('translate') === false);
assert('code compression is disabled by default', appConfig.get('codeCompression') === false);
assert('response hints are disabled by default', appConfig.get('responseLengthHints') === false);
assert('prompt cache is enabled by default', appConfig.get('promptCache') === true);
assert('briefs are enabled by default', appConfig.get('briefsEnabled') === true);
assert('brief token budget has a default value', appConfig.get('briefTokenBudget') === 220);
assert('memory token budget has a default value', appConfig.get('memoryTokenBudget') === 180);
assert('reset advisor is enabled by default', appConfig.get('resetAdvisor') === true);
assert('reset advisor turn threshold has a default value', appConfig.get('resetAdvisorTurns') === 15);

// ── ContextMonitor ────────────────────────────────────────────────────────────
console.log('\n── ContextMonitor ──');
const monitor = new ContextMonitor({ get: (k) => ({ costThreshold: 0.80, commandThreshold: 25, backend: 'claude' }[k]) });
monitor.trackCommand();
monitor.trackTurn({
  promptTokens: 120,
  outputTokens: 200,
  model: 'haiku',
  savingsBreakdown: [
    { step: 'trim-log', kind: 'input', saved: 20 },
    { step: 'output-hint', kind: 'output', saved: 30 },
  ],
});
const status = monitor.getStatus();
assert('tracks commands',                status.commands === 1);
assert('tracks input tokens sent',       status.estimatedInputTokens === 120);
assert('tracks output tokens received',  status.estimatedOutputTokens === 200);
assert('tracks avoided tokens',          status.estimatedTokensAvoided === 50);
assert('tracks routing impact separately', status.savingsBreakdownUsd.routing > 0);
assert('tracks spend estimate',          parseFloat(status.cost) > 0);
assert('no handoff yet',                 !monitor.shouldHandoff());

const cacheMonitor = new ContextMonitor({ get: (k) => ({ costThreshold: 0.80, commandThreshold: 25, backend: 'claude' }[k]) });
cacheMonitor.trackTurn({
  promptTokens: 80,
  outputTokens: 120,
  model: 'sonnet',
  cacheHit: true,
  savingsBreakdown: [
    { step: 'trim-log', kind: 'input', saved: 15 },
    { step: 'output-hint', kind: 'output', saved: 10 },
  ],
});
const cacheStatus = cacheMonitor.getStatus();
assert('cache hit avoids only the cached request tokens', cacheStatus.estimatedTokensAvoided === 200);

const liveFile = getCCSOPath('session_live.json');
monitor.saveToLog(false);
assert('saving session clears live session file', !fs.existsSync(liveFile));

const turnMonitor = new ContextMonitor(
  { get: (k) => ({ costThreshold: 0.80, commandThreshold: 25, backend: 'claude' }[k]) },
  { liveWrites: false },
);
turnMonitor.trackCommand();
turnMonitor.trackTurn({
  promptTokens: 40,
  outputTokens: 60,
  model: 'sonnet',
  savingsBreakdown: [{ step: 'trim-log', kind: 'input', saved: 10 }],
});
turnMonitor.appendLogEntry({ type: 'turn', source: 'dashboard-chat', clearLive: true });
const usageEntries = fs.readFileSync(getCCSOPath('usage.log'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
const lastEntry = usageEntries[usageEntries.length - 1];
assert('custom log entry keeps source metadata', lastEntry.type === 'turn' && lastEntry.source === 'dashboard-chat');
assert('live-writes can be disabled for dashboard turns', !fs.existsSync(liveFile));

const resetMonitor = new ContextMonitor(
  {
    get: (k) => ({
      costThreshold: 100,
      commandThreshold: 25,
      backend: 'claude',
      resetAdvisor: true,
      resetAdvisorTurns: 2,
      resetAdvisorMinutes: 999,
      resetAdvisorTokenThreshold: 999999,
    }[k]),
  },
  { liveWrites: false },
);
resetMonitor.trackTurn({ promptTokens: 15, outputTokens: 25, model: 'sonnet' });
resetMonitor.trackTurn({ promptTokens: 20, outputTokens: 30, model: 'sonnet' });
const resetStatus = resetMonitor.getStatus();
assert('tracks turn count for reset advisor', resetStatus.turns === 2);
assert('reset advisor recommends reset after threshold', resetStatus.resetAdvice?.recommended === true);
assert('reset advisor emits a notice once', resetMonitor.consumeResetAdviceNotice()?.recommended === true);
assert('reset advisor notice is deduplicated', resetMonitor.consumeResetAdviceNotice() === null);

// ── PromptCache ───────────────────────────────────────────────────────────────
console.log('\n── PromptCache ──');
const cache = new PromptCache({ get: () => undefined });
cache.clear();
cache.set('test prompt', 'test response', 'haiku');
assert('cache set and get',         cache.get('test prompt', 'haiku')?.response === 'test response');
assert('cache miss on wrong model', cache.get('test prompt', 'sonnet') === null);
assert('cache miss on wrong prompt',cache.get('other prompt', 'haiku') === null);
cache.set('prompt with spaces  \r\nline two\t', 'normalized response', 'haiku');
assert('cache matches conservative whitespace normalization', cache.get('  prompt with spaces\nline two   ', 'haiku')?.response === 'normalized response');
assert('cache size',                cache.size() === 2);
cache.clear();
assert('cache cleared',             cache.size() === 0);

// ── PromptBundler ────────────────────────────────────────────────────────────
console.log('\n── PromptBundler ──');
const bundler = new PromptBundler();
const bundledPrompt = bundler.bundle('fix login bug; add tests; explain root cause');
assert('bundler combines multiple items', bundledPrompt.bundled && bundledPrompt.itemCount === 3);
assert('bundler produces numbered tasks', bundledPrompt.prompt.includes('1. fix login bug'));
assert('bundle command dispatches when multiple tasks exist', handleBundleCommand('/bundle fix login bug; add tests').dispatch === true);
assert('bundle command asks for more than one item', handleBundleCommand('/bundle only one task').dispatch === false);

// ── Memory ───────────────────────────────────────────────────────────────────
console.log('\n── Memory ──');
const memory = new Memory({
  get: (key) => ({
    memoryEnabled: true,
    memoryTokenBudget: 80,
    memoryMaxFacts: 2,
  }[key]),
});
memory.clear();
memory.clear(true);
memory.add('Auth service lives in src/auth/service.js');
memory.add('Billing uses Stripe webhooks');
memory.add('Use pnpm for workspace commands', true);
const memoryContext = memory.buildContextPrefix('Fix auth bug in src/auth/service.js');
assert('memory keeps relevant fact for current prompt', memoryContext.includes('src/auth/service.js'));
assert('memory filters unrelated facts when there is a match', !memoryContext.includes('Billing uses Stripe webhooks'));
assert('memory filters unrelated global facts when there is a match', !memoryContext.includes('Use pnpm for workspace commands'));
memory.clear();
memory.clear(true);

// ── ProjectBriefs ────────────────────────────────────────────────────────────
console.log('\n── ProjectBriefs ──');
const briefFile = path.join(testHome, 'ARCHITECTURE.md');
fs.writeFileSync(briefFile, [
  '# Auth Flow',
  '',
  'Authentication lives in src/auth/service.js and handles login plus refresh tokens.',
  '',
  '## Notes',
  '',
  '- Billing uses Stripe webhooks.',
].join('\n'));

const briefs = new ProjectBriefs({
  get: (key) => ({
    briefsEnabled: true,
    briefTokenBudget: 220,
  }[key]),
});

const savedBrief = briefs.save(briefFile);
assert('brief save records markdown files', savedBrief.kind === 'Markdown');
assert('brief show returns stored entry', briefs.show(briefFile)?.path === savedBrief.path);
const briefContext = briefs.getContextForQuery('Please update ARCHITECTURE.md and the auth flow docs');
assert('brief context is injected when file is mentioned', briefContext.matches.some((match) => match.endsWith('ARCHITECTURE.md')));
assert('brief context contains saved brief marker', briefContext.prefix.includes('[Saved brief:'));
fs.writeFileSync(briefFile, '# Auth Flow\n\nThis file changed after the brief was saved.\n');
const staleBriefContext = briefs.getContextForQuery('ARCHITECTURE.md');
assert('stale briefs are detected and skipped', staleBriefContext.stale.some((match) => match.endsWith('ARCHITECTURE.md')) && staleBriefContext.matches.length === 0);
briefs.clear();

// ── Platform Support ──────────────────────────────────────────────────────────
console.log('\n── Platform Support ──');
const platforms = await getSupportedPlatformStatuses();
assert('platform catalog excludes codex', !platforms.some((p) => p.id === 'codex'));
assert('claude marked as full backend', platforms.find((p) => p.id === 'claude')?.supportLevel === 'full-backend');
assert('copilot marked as instruction-only', platforms.find((p) => p.id === 'copilot')?.supportLevel === 'instruction-file');
assert('claude marked as measured runtime', platforms.find((p) => p.id === 'claude')?.dashboardGroup === 'measured-runtime');
assert('cursor marked as assisted but unmeasured', platforms.find((p) => p.id === 'cursor')?.savingsMode === 'assisted-unmeasured');
assert('notebooklm marked as utility', platforms.find((p) => p.id === 'notebooklm')?.dashboardGroup === 'utility');

const featureCatalog = getFeatureCatalog(appConfig);
assert('feature catalog marks translate as disabled by default', featureCatalog.find((f) => f.id === 'translate')?.enabled === false);
assert('feature catalog marks smart routing as enabled', featureCatalog.find((f) => f.id === 'model-routing')?.enabled === true);
assert('feature catalog exposes cache toggle state', featureCatalog.find((f) => f.id === 'cache')?.enabled === true);
assert('feature catalog exposes briefs as estimated context reuse', featureCatalog.find((f) => f.id === 'briefs')?.dashboardCategory === 'estimated-impact');
assert('feature catalog exposes prompt bundler as workflow helper', featureCatalog.find((f) => f.id === 'prompt-bundler')?.dashboardCategory === 'workflow-quality');
assert('feature catalog exposes reset advisor as quota hygiene', featureCatalog.find((f) => f.id === 'session-reset-advisor')?.dashboardCategory === 'quota-hygiene');

// ── Dashboard Share ──────────────────────────────────────────────────────────
console.log('\n── Dashboard Share ──');
assert('extract tunnel URL from localtunnel output', extractTunnelUrl('your url is: https://ccso-demo.loca.lt\n') === 'https://ccso-demo.loca.lt');
assert('extract tunnel URL from cloudflared output', extractTunnelUrl('trycloudflare url: https://bright-moon.trycloudflare.com') === 'https://bright-moon.trycloudflare.com');
assert('no tunnel URL returns null', extractTunnelUrl('waiting for tunnel...') === null);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);

fs.rmSync(testHome, { recursive: true, force: true });

if (failed > 0) process.exit(1);
