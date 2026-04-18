/**
 * Interceptor Engine
 * Processes every user input before it reaches the AI backend.
 *
 * Pipeline (in order):
 *   1. Trim long logs → last 50 lines
 *   2. Translate Hebrew → English
 *   3. Strip politeness words
 *   4. Resolve relative filenames → absolute paths
 *   5. Compress code blocks (strip comments + extra whitespace)
 *   6. Scan for leaked secrets (API keys, passwords)
 *   7. Inject Git context (auto-add diff when relevant)
 */

import fetch from 'node-fetch';
import * as path from 'path';
import * as fs   from 'fs';
import { execSync } from 'child_process';
import { countTokens, sumSavedTokens } from './token-utils.js';
import { getConfigValue } from './default-config.js';

const HEBREW_REGEX = /[\u0590-\u05FF]/;

const POLITENESS_WORDS = [
  /בבקשה/g, /תודה/g, /אנא/g, /האם תוכל/g, /האם ניתן/g,
  /\bplease\b/gi, /\bthank you\b/gi, /\bthanks\b/gi,
  /\bcould you please\b/gi, /\bwould you mind\b/gi,
];

// Patterns that suggest git context would help
const GIT_TRIGGERS = [
  /\b(תקן|fix|debug|שגיאה|error|crash|bug|שבור|broken|לא עובד|not working)\b/i,
  /\b(שינוי|change|diff|commit|merge|branch)\b/i,
  /\b(הוסף|add feature|implement)\b/i,
];

// Secret patterns to warn about
const SECRET_PATTERNS = [
  { name: 'Anthropic API Key', regex: /sk-ant-api\d{2}-[A-Za-z0-9_-]{86}/g },
  { name: 'OpenAI API Key',    regex: /sk-[A-Za-z0-9]{48}/g },
  { name: 'AWS Access Key',    regex: /AKIA[A-Z0-9]{16}/g },
  { name: 'Generic API Key',   regex: /api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/gi },
  { name: 'Password',          regex: /password\s*[:=]\s*["'][^"']{6,}["']/gi },
  { name: 'Secret',            regex: /secret\s*[:=]\s*["'][^"']{6,}["']/gi },
];

const LOG_SIGNAL_REGEX = /(error|exception|fatal|traceback|panic|failed|failure|uncaught|unhandled|typeerror|referenceerror|syntaxerror|500\b|segmentation fault)/i;
const LOG_STACK_REGEX = /^\s*(at\s+|File\s+".*", line \d+|Caused by:|Traceback)/;
const LOG_LINE_REGEX = /^(\[.*\]\s+)?(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\b/i;

export class Interceptor {
  constructor(config) {
    this.config               = config;
    this.translateEnabled     = Boolean(getConfigValue(config, 'translate'));
    this.stripPoliteness      = Boolean(getConfigValue(config, 'stripPoliteness'));
    this.resolvePathsEnabled  = Boolean(getConfigValue(config, 'resolvePaths'));
    this.trimLogsEnabled      = Boolean(getConfigValue(config, 'trimLogs'));
    this.truncateLargeEnabled = Boolean(getConfigValue(config, 'truncateLargePastes'));
    this.dedupeEnabled        = Boolean(getConfigValue(config, 'dedupeLongInput'));
    this.compressCodeEnabled  = Boolean(getConfigValue(config, 'codeCompression'));
    this.responseHintsEnabled = Boolean(getConfigValue(config, 'responseLengthHints'));
    this.secretScanEnabled    = Boolean(getConfigValue(config, 'secretScanner'));
    this.gitContextEnabled    = Boolean(getConfigValue(config, 'gitContext'));
  }

  async processWithStats(input) {
    const { text, warnings, savings, actions } = await this.process(input);
    return {
      text,
      warnings,
      savings,
      actions,
      inputTokensBefore: countTokens(input),
      inputTokensAfter: countTokens(text),
      inputTokensSaved: sumSavedTokens(savings, 'input'),
      estimatedOutputTokensSaved: sumSavedTokens(savings, 'output'),
    };
  }

  async process(input) {
    let result   = input;
    const actions  = [];
    const warnings = [];
    const savings  = []; // { step, saved (input tokens) }

    const snap = () => countTokens(result);

    // 1. Trim long logs
    if (this.trimLogsEnabled && this._looksLikeLog(result)) {
      const before = snap();
      result = this._trimLog(result);
      const saved = before - snap();
      if (saved > 0) { savings.push({ step: 'trim-log', kind: 'input', saved }); actions.push(`✂️  לוג קוצץ (חסכנו ~${saved} טוקנים)`); }
    }

    // 2. Truncate large inline file content (>300 lines pasted)
    if (this.truncateLargeEnabled) {
      const truncated = this._truncateLargeContent(result);
      if (truncated !== result) {
        const saved = snap() - countTokens(truncated);
        result = truncated;
        if (saved > 0) { savings.push({ step: 'truncate', kind: 'input', saved }); actions.push(`📄 קובץ גדול קוצץ (חסכנו ~${saved} טוקנים)`); }
      }
    }

    // 3. Remove duplicate sentences/lines
    if (this.dedupeEnabled) {
      const deduped = this._deduplicateContent(result);
      if (deduped !== result) {
        const saved = snap() - countTokens(deduped);
        result = deduped;
        if (saved > 0) { savings.push({ step: 'dedupe', kind: 'input', saved }); actions.push(`🔁 תוכן כפול הוסר (חסכנו ~${saved} טוקנים)`); }
      }
    }

    // 4. Translate Hebrew → English
    if (this.translateEnabled && HEBREW_REGEX.test(result)) {
      const before = snap();
      const translated = await this._translate(result);
      if (translated && translated !== result) {
        result = translated;
        const saved = before - snap();
        if (saved > 0) savings.push({ step: 'translate', kind: 'input', saved });
        actions.push(`🔄 תורגם עברית → אנגלית${saved > 0 ? ` (חסכנו ~${saved} טוקנים)` : ''}`);
      }
    }

    // 5. Strip politeness
    if (this.stripPoliteness) {
      const before = snap();
      const stripped = this._stripPoliteWords(result);
      if (stripped !== result) {
        result = stripped;
        const saved = before - snap();
        if (saved > 0) { savings.push({ step: 'politeness', kind: 'input', saved }); actions.push(`🧹 נימוסים הוסרו (חסכנו ~${saved} טוקנים)`); }
      }
    }

    // 6. Resolve file paths
    if (this.resolvePathsEnabled) {
      const resolved = this._resolvePaths(result);
      if (resolved !== result) { result = resolved; actions.push('📁 נתיבים הורחבו לנתיבים מוחלטים'); }
    }

    // 7. Compress code blocks
    if (this.compressCodeEnabled && result.includes('```')) {
      const { text: compressed, saved: charsSaved } = this._compressCode(result);
      if (charsSaved > 5) {
        const toksSaved = Math.ceil(charsSaved / 4);
        savings.push({ step: 'code-compress', kind: 'input', saved: toksSaved });
        actions.push(`⚡ קוד דוחס (חסכנו ~${toksSaved} טוקנים)`);
        result = compressed;
      }
    }

    // 8. Add response-length hint for simple queries (saves OUTPUT tokens)
    if (this.responseHintsEnabled) {
      const lengthHint = this._buildLengthHint(result);
      if (lengthHint) {
        result = result + lengthHint.suffix;
        savings.push({ step: 'output-hint', kind: 'output', saved: lengthHint.estimatedSaved });
        actions.push(`📏 הוגבל אורך תגובה (חיסכון משוער ~${lengthHint.estimatedSaved} טוקנים פלט)`);
      }
    }

    // 9. Scan for secrets
    if (this.secretScanEnabled) {
      const found = this._scanSecrets(result);
      for (const name of found) warnings.push(`⚠️  זוהה ${name} בפרומפט — בדוק שלא חשפת מידע רגיש!`);
    }

    // 10. Inject Git context (adds tokens intentionally)
    if (this.gitContextEnabled && this._shouldInjectGit(result)) {
      const gitCtx = this._getGitContext();
      if (gitCtx) { result = gitCtx + '\n\n' + result; actions.push('🔀 הקשר Git נוסף אוטומטית'); }
    }

    if (actions.length > 0) console.log('\n' + actions.map(a => `  [CCSO] ${a}`).join('\n'));
    for (const w of warnings) console.log(`\n  \x1b[33m${w}\x1b[0m`);

    return { text: result, warnings, savings, actions };
  }

  // ── New: Truncate large inline content ────────────────────────────────────────
  _truncateLargeContent(text) {
    const lines = text.split('\n');
    if (lines.length <= 300) return text;
    // Keep first 150 + last 50 lines, add marker
    return [
      ...lines.slice(0, 150),
      `\n... [CCSO: ${lines.length - 200} שורות קוצצו לחיסכון בטוקנים] ...\n`,
      ...lines.slice(-50)
    ].join('\n');
  }

  // ── New: Remove duplicate lines/sentences ─────────────────────────────────────
  _deduplicateContent(text) {
    const lines = text.split('\n');
    if (lines.length < 10) return text; // only for longer prompts
    const seen = new Set();
    const result = [];
    for (const line of lines) {
      const key = line.trim().toLowerCase();
      if (key.length < 8 || !seen.has(key)) {
        result.push(line);
        if (key.length >= 8) seen.add(key);
      }
    }
    return result.join('\n');
  }

  // ── New: Response length hint ──────────────────────────────────────────────────
  _buildLengthHint(text) {
    const lower = text.toLowerCase().trim();
    const words = lower.split(/\s+/).length;
    if (words > 40) return null; // complex query — don't limit

    // Simple question patterns
    if (/^(what|מה|who|מי|when|מתי|where|איפה|how many|כמה)\b/.test(lower)) {
      return { suffix: ' Answer in 1-2 sentences only.', estimatedSaved: 120 };
    }
    if (/^(yes or no|כן או לא|is it|האם זה|does it|האם ה)/.test(lower)) {
      return { suffix: ' Answer yes/no with one short explanation.', estimatedSaved: 150 };
    }
    if (/(list|רשום|enumerate|פרט)\b/.test(lower) && words < 20) {
      return { suffix: ' Use bullet points, max 6 items, no prose.', estimatedSaved: 100 };
    }
    return null;
  }

  // ── Translation ─────────────────────────────────────────────────────────────

  async _translate(text) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      return data[0].map(chunk => chunk[0]).join('');
    } catch {
      return text; // fail silently
    }
  }

  async translate(text) {
    if (!this.translateEnabled || !HEBREW_REGEX.test(text)) return text;
    return this._translate(text);
  }

  // ── Politeness ──────────────────────────────────────────────────────────────

  _stripPoliteWords(text) {
    let r = text;
    for (const p of POLITENESS_WORDS) r = r.replace(p, '').replace(/\s+/g, ' ').trim();
    return r;
  }

  // ── Log trimming ─────────────────────────────────────────────────────────────

  _looksLikeLog(text) {
    const lines = text.split('\n');
    return lines.length > 60 && /(error|warning|exception|traceback|fatal|\bat\s)/i.test(text);
  }

  _trimLog(text) {
    const lines = text.split('\n');
    const preamble = [];
    let logStart = 0;

    for (let i = 0; i < lines.length; i++) {
      if (this._isLogLikeLine(lines[i])) {
        logStart = i;
        break;
      }
      if (lines[i].trim()) preamble.push(lines[i]);
    }

    const logLines = lines.slice(logStart);
    const selectedIndexes = new Set();
    const interestingIndexes = [];

    for (let i = 0; i < logLines.length; i++) {
      if (this._isInterestingLogLine(logLines[i])) {
        interestingIndexes.push(i);
      }
    }

    if (interestingIndexes.length > 0) {
      for (const index of interestingIndexes.slice(-8)) {
        this._addLogWindow(selectedIndexes, index, logLines.length, 2, 4);

        for (let offset = 1; offset <= 6; offset++) {
          const followIndex = index + offset;
          if (followIndex >= logLines.length) break;
          const line = logLines[followIndex];
          if (!line.trim()) break;
          if (LOG_STACK_REGEX.test(line) || this._isInterestingLogLine(line)) {
            selectedIndexes.add(followIndex);
            continue;
          }
          if (LOG_LINE_REGEX.test(line)) break;
        }
      }
    } else {
      for (let i = Math.max(0, logLines.length - 50); i < logLines.length; i++) {
        selectedIndexes.add(i);
      }
    }

    for (let i = Math.max(0, logLines.length - 15); i < logLines.length; i++) {
      selectedIndexes.add(i);
    }

    const selectedLines = [];
    let previousIndex = null;
    for (const index of [...selectedIndexes].sort((a, b) => a - b)) {
      if (previousIndex !== null && index - previousIndex > 1) {
        selectedLines.push('... [CCSO omitted unrelated log lines] ...');
      }
      selectedLines.push(logLines[index]);
      previousIndex = index;
    }

    const parts = [];
    if (preamble.length > 0) {
      parts.push(preamble.slice(0, 3).join('\n'));
    }

    const header = interestingIndexes.length > 0
      ? `[Log trimmed — focused on ${interestingIndexes.length} error/signature block(s) plus recent tail]`
      : '[Log trimmed — showing most recent log tail]';

    parts.push(header);
    parts.push(selectedLines.join('\n'));

    return parts.filter(Boolean).join('\n');
  }

  _isLogLikeLine(line = '') {
    return LOG_LINE_REGEX.test(line)
      || /^\d{4}-\d{2}-\d{2}/.test(line)
      || /^\[[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(line)
      || LOG_STACK_REGEX.test(line);
  }

  _isInterestingLogLine(line = '') {
    return LOG_SIGNAL_REGEX.test(line) || LOG_STACK_REGEX.test(line);
  }

  _addLogWindow(indexSet, center, total, before = 2, after = 4) {
    const start = Math.max(0, center - before);
    const end = Math.min(total - 1, center + after);
    for (let i = start; i <= end; i++) {
      indexSet.add(i);
    }
  }

  // ── Path resolution ──────────────────────────────────────────────────────────

  _resolvePaths(text) {
    const pattern = /\b([\w-]+\.(ts|js|tsx|jsx|py|go|rs|java|css|json|md))\b/g;
    let result = text;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const abs = this._findFile(match[1]);
      if (abs) result = result.replace(match[1], abs);
    }
    return result;
  }

  _findFile(filename) {
    try { return this._searchDir(process.cwd(), filename, 0, 4); } catch { return null; }
  }

  _searchDir(dir, filename, depth, max) {
    if (depth > max) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name === filename) return full;
      if (e.isDirectory()) {
        const found = this._searchDir(full, filename, depth + 1, max);
        if (found) return found;
      }
    }
    return null;
  }

  // ── Code compression ─────────────────────────────────────────────────────────

  _compressCode(text) {
    const originalLen = text.length;
    let result = text;

    // Compress each code block
    result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      let compressed = code;

      // Remove single-line comments (// ...) but NOT URLs
      compressed = compressed.replace(/(?<!https?:)\/\/(?!\/)[^\n]*/g, '');

      // Remove multi-line comments (/* ... */)
      compressed = compressed.replace(/\/\*[\s\S]*?\*\//g, '');

      // Remove Python/shell/Ruby comments (# ...) — only if lang is py/sh/bash/rb
      if (['py', 'python', 'sh', 'bash', 'shell', 'rb', 'ruby'].includes(lang.toLowerCase())) {
        compressed = compressed.replace(/^\s*#[^\n]*/gm, '');
      }

      // Remove debug/console statements (console.log/warn/debug/info, print(), fmt.Println debug)
      compressed = compressed.replace(/^\s*console\.(log|warn|debug|info)\([^)]*\);?\s*\n/gm, '\n');
      compressed = compressed.replace(/^\s*print\(f?["'][^"']*["']\);\s*\n/gm, '\n');

      // Collapse blank lines between import/require statements to zero
      compressed = compressed.replace(/((?:import\s+[^\n]+\n|const\s+\w+\s*=\s*require[^\n]+\n))\n+((?:import\s+|const\s+\w+\s*=\s*require))/g, '$1$2');

      // Collapse 3+ consecutive blank lines → 1
      compressed = compressed.replace(/\n{3,}/g, '\n\n');

      // Remove trailing whitespace on each line
      compressed = compressed.split('\n').map(l => l.trimEnd()).join('\n');

      // Collapse multiple horizontal spaces to one on each line (not newlines)
      compressed = compressed.split('\n').map(l => l.replace(/([^"'`]) {2,}/g, '$1 ')).join('\n');

      return '```' + lang + '\n' + compressed.trim() + '\n```';
    });

    return { text: result, saved: originalLen - result.length };
  }

  // ── Secret scanner ───────────────────────────────────────────────────────────

  _scanSecrets(text) {
    const found = [];
    for (const { name, regex } of SECRET_PATTERNS) {
      if (regex.test(text)) found.push(name);
      regex.lastIndex = 0; // reset global regex
    }
    return found;
  }

  // ── Git context ───────────────────────────────────────────────────────────────

  _shouldInjectGit(text) {
    return GIT_TRIGGERS.some(p => p.test(text));
  }

  _getGitContext() {
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });

      const status  = execSync('git status -s 2>/dev/null', { encoding: 'utf8' }).trim();
      const logLine = execSync('git log --oneline -3 2>/dev/null', { encoding: 'utf8' }).trim();

      // Get a compact diff (max 30 lines)
      let diff = '';
      try {
        const rawDiff = execSync('git diff --unified=2 2>/dev/null', { encoding: 'utf8' });
        if (rawDiff) {
          const lines = rawDiff.split('\n');
          diff = '\nGit diff (excerpt):\n' + lines.slice(0, 30).join('\n') + (lines.length > 30 ? '\n... (truncated)' : '');
        }
      } catch { /* no diff */ }

      if (!status && !logLine) return null;

      return `[Git context — auto-injected by CCSO]
Status: ${status || 'clean'}
Recent commits: ${logLine || 'none'}${diff}
[/Git context]`;
    } catch {
      return null; // not a git repo
    }
  }
}
