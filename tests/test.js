/**
 * CCSO Basic Test Suite
 * Run: node tests/test.js
 */

import { Interceptor }  from '../src/core/interceptor.js';
import { ModelRouter }  from '../src/core/model-router.js';
import { PromptCache }  from '../src/core/cache.js';
import { ContextMonitor } from '../src/core/context-monitor.js';

const cfg = { get: (k) => ({ gitContext: false, translate: false }[k]) };
let passed = 0, failed = 0;

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
  'fix the bug\nfix the bug\nthe problem is in the auth module\nthe problem is in the auth module\ncheck the logs\ncheck the logs\ncheck the logs\ncheck the logs\nfix the bug\ncheck the config'
);
assert('deduplication removes repeated lines', deduped.split('\n').length < 10);

const hint = ix._buildLengthHint('what is Node.js?');
assert('length hint for simple question', hint !== null);
assert('no length hint for long text', ix._buildLengthHint('explain in detail how the authentication flow works with refresh tokens and why we need them') === null);

// ── ContextMonitor ────────────────────────────────────────────────────────────
console.log('\n── ContextMonitor ──');
const monitor = new ContextMonitor({ get: (k) => ({ costThreshold: 0.80, commandThreshold: 25 }[k]) });
monitor.trackCommand();
monitor.trackOutput('Hello world response', 100, 'claude-haiku-4-5-20251001');
const status = monitor.getStatus();
assert('tracks commands',      status.commands === 1);
assert('tracks token savings', status.tokensSaved === 100);
assert('tracks dollar savings', status.dollarsSaved > 0);
assert('no handoff yet',       !monitor.shouldHandoff());

// ── PromptCache ───────────────────────────────────────────────────────────────
console.log('\n── PromptCache ──');
const cache = new PromptCache({ get: () => undefined });
cache.clear();
cache.set('test prompt', 'test response', 'haiku');
assert('cache set and get',         cache.get('test prompt', 'haiku')?.response === 'test response');
assert('cache miss on wrong model', cache.get('test prompt', 'sonnet') === null);
assert('cache miss on wrong prompt',cache.get('other prompt', 'haiku') === null);
assert('cache size',                cache.size() === 1);
cache.clear();
assert('cache cleared',             cache.size() === 0);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
