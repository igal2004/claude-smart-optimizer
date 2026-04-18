import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getCCSOPath } from './storage-paths.js';
import { countTokens } from './token-utils.js';

const BRIEFS_FILE = getCCSOPath('briefs.json');

function stripQuotes(text = '') {
  return text.trim().replace(/^["']|["']$/g, '');
}

function uniq(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function truncateText(text = '', maxLength = 180) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + '…';
}

function hashContent(content = '') {
  return crypto.createHash('sha1').update(content).digest('hex');
}

function describeKind(ext = '', content = '') {
  if (['.md', '.markdown'].includes(ext)) return 'Markdown';
  if (['.txt', '.rst'].includes(ext)) return 'Text';
  if (['.json', '.yaml', '.yml', '.toml'].includes(ext)) return 'Config';
  if (['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.rs', '.java', '.rb', '.php'].includes(ext)) return 'Code';
  if (/^\s*#/.test(content)) return 'Document';
  return ext ? `${ext.slice(1).toUpperCase()} file` : 'File';
}

function extractImports(content = '', ext = '') {
  const matches = [];

  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
    for (const match of content.matchAll(/^\s*import .*? from ['"]([^'"]+)['"]/gm)) matches.push(match[1]);
    for (const match of content.matchAll(/require\(['"]([^'"]+)['"]\)/g)) matches.push(match[1]);
  } else if (ext === '.py') {
    for (const match of content.matchAll(/^\s*from\s+([^\s]+)\s+import /gm)) matches.push(match[1]);
    for (const match of content.matchAll(/^\s*import\s+([^\s]+)/gm)) matches.push(match[1]);
  }

  return uniq(matches).slice(0, 5);
}

function extractSymbols(content = '', ext = '') {
  const matches = [];

  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
    for (const match of content.matchAll(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)) matches.push(match[1]);
    for (const match of content.matchAll(/^\s*(?:export\s+)?class\s+([A-Za-z0-9_$]+)/gm)) matches.push(match[1]);
    for (const match of content.matchAll(/^\s*(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\(|function)/gm)) matches.push(match[1]);
  } else if (ext === '.py') {
    for (const match of content.matchAll(/^\s*(?:async\s+def|def|class)\s+([A-Za-z_][A-Za-z0-9_]*)/gm)) matches.push(match[1]);
  } else if (ext === '.go') {
    for (const match of content.matchAll(/^\s*func\s+([A-Za-z0-9_]+)/gm)) matches.push(match[1]);
    for (const match of content.matchAll(/^\s*type\s+([A-Za-z0-9_]+)/gm)) matches.push(match[1]);
  } else if (ext === '.rs') {
    for (const match of content.matchAll(/^\s*(?:pub\s+)?fn\s+([A-Za-z0-9_]+)/gm)) matches.push(match[1]);
    for (const match of content.matchAll(/^\s*(?:pub\s+)?struct\s+([A-Za-z0-9_]+)/gm)) matches.push(match[1]);
  }

  return uniq(matches).slice(0, 7);
}

function extractHeadings(content = '') {
  const matches = [];
  for (const match of content.matchAll(/^\s{0,3}#{1,3}\s+(.+)/gm)) matches.push(match[1].trim());
  return uniq(matches).slice(0, 6);
}

function extractSummary(content = '', ext = '') {
  if (['.md', '.markdown', '.txt', '.rst'].includes(ext)) {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    return truncateText(lines.join(' '), 180);
  }

  const commentMatch = content.match(/^\s*(?:\/\/|#|\/\*+)\s*(.+)$/m);
  if (commentMatch?.[1]) return truncateText(commentMatch[1].trim(), 140);

  const meaningful = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('//') && !line.startsWith('#') && !line.startsWith('*'));
  return meaningful ? truncateText(meaningful, 140) : '';
}

export class ProjectBriefs {
  constructor(config) {
    this.config = config;
    this.enabled = config.get('briefsEnabled') !== false;
    this.tokenBudget = Math.max(80, Number(config.get('briefTokenBudget')) || 220);
  }

  handleCommand(input) {
    const trimmed = String(input || '').trim();
    if (!trimmed.startsWith('/brief')) return { handled: false };

    const rest = trimmed.replace('/brief', '').trim();
    if (!rest || rest === 'list') {
      return { handled: true, message: this._formatListMessage() };
    }

    if (rest.startsWith('save ')) {
      const target = stripQuotes(rest.slice(5));
      try {
        const entry = this.save(target);
        return {
          handled: true,
          message: `\n  📚 נשמר brief עבור ${entry.path}\n  ${entry.kind} · ${entry.lineCount} שורות\n`,
        };
      } catch (error) {
        return { handled: true, message: `\n  ❌ ${error.message}\n` };
      }
    }

    if (rest.startsWith('show ')) {
      const target = stripQuotes(rest.slice(5));
      const entry = this.show(target);
      if (!entry) {
        return { handled: true, message: '\n  לא נמצא brief שמור עבור הנתיב הזה.\n' };
      }
      const stale = this._isEntryStale(entry) ? ' (stale)' : '';
      return {
        handled: true,
        message: `\n  📄 ${entry.path}${stale}\n${entry.contextText}\n`,
      };
    }

    if (rest === 'clear') {
      const deleted = this.clear();
      return { handled: true, message: `\n  🗑️  נמחקו ${deleted} briefs שמורים.\n` };
    }

    return {
      handled: true,
      message: '\n  שימוש: /brief [list | save <path> | show <path> | clear]\n',
    };
  }

  save(filePath) {
    const resolved = this._resolveFilePath(filePath);
    const content = this._readTextFile(resolved);
    const entry = this._buildEntry(resolved, content);
    const store = this._readStore();
    store.entries = store.entries.filter((item) => item.path !== entry.path);
    store.entries.push(entry);
    store.entries.sort((a, b) => a.path.localeCompare(b.path));
    this._writeStore(store);
    return entry;
  }

  show(filePath) {
    const target = this._normalizeProjectPath(filePath);
    return this._readStore().entries.find((entry) => entry.path === target) || null;
  }

  list() {
    return this._readStore().entries.map((entry) => ({
      ...entry,
      stale: this._isEntryStale(entry),
    }));
  }

  clear() {
    const count = this._readStore().entries.length;
    try {
      fs.rmSync(BRIEFS_FILE, { force: true });
    } catch {
      // ignore
    }
    return count;
  }

  getContextForQuery(query = '') {
    if (!this.enabled) {
      return { prefix: '', matches: [], stale: [] };
    }

    const normalizedQuery = String(query || '').toLowerCase();
    const candidates = this.list()
      .map((entry) => ({
        entry,
        score: this._matchScore(normalizedQuery, entry),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.entry.path.localeCompare(b.entry.path));

    const selected = [];
    const stale = [];
    let usedTokens = 0;

    for (const { entry } of candidates) {
      if (entry.stale) {
        stale.push(entry.path);
        continue;
      }

      const block = `[Saved brief: ${entry.path}]\n${entry.contextText}`;
      const blockTokens = countTokens(block);
      if (selected.length > 0 && usedTokens + blockTokens > this.tokenBudget) continue;

      selected.push(block);
      usedTokens += blockTokens;
    }

    return {
      prefix: selected.length ? `${selected.join('\n\n')}\n\n` : '',
      matches: selected.map((block) => block.match(/\[Saved brief: (.+?)\]/)?.[1]).filter(Boolean),
      stale,
    };
  }

  _formatListMessage() {
    const entries = this.list();
    if (!entries.length) {
      return '\n  אין עדיין briefs שמורים.\n  השתמש ב: /brief save <path>\n';
    }

    const lines = entries.map((entry) => {
      const stale = entry.stale ? ' · stale' : '';
      return `  • ${entry.path}  (${entry.kind}, ${entry.lineCount} שורות${stale})`;
    });

    return `\n  Briefs שמורים:\n${lines.join('\n')}\n`;
  }

  _buildEntry(filePath, content) {
    const projectPath = this._normalizeProjectPath(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const lines = content.split(/\r?\n/);
    const kind = describeKind(ext, content);
    const imports = extractImports(content, ext);
    const symbols = extractSymbols(content, ext);
    const headings = extractHeadings(content);
    const summary = extractSummary(content, ext);

    const bullets = [
      `- Type: ${kind} · ${lines.length} lines`,
    ];
    if (symbols.length) bullets.push(`- Symbols: ${symbols.join(', ')}`);
    if (imports.length) bullets.push(`- Imports: ${imports.join(', ')}`);
    if (headings.length) bullets.push(`- Headings: ${headings.join(' · ')}`);
    if (summary) bullets.push(`- Summary: ${summary}`);

    let contextText = bullets.join('\n');
    while (countTokens(contextText) > Math.max(90, this.tokenBudget - 40) && bullets.length > 2) {
      bullets.pop();
      contextText = bullets.join('\n');
    }

    return {
      path: projectPath,
      basename: path.basename(projectPath),
      kind,
      lineCount: lines.length,
      updatedAt: new Date().toISOString(),
      hash: hashContent(content),
      contextText,
    };
  }

  _matchScore(query = '', entry) {
    if (!query) return 0;
    let score = 0;
    const entryPath = entry.path.toLowerCase();
    const basename = entry.basename.toLowerCase();

    if (query.includes(entryPath)) score += 10;
    if (query.includes(basename)) score += 8;

    for (const segment of entryPath.split(/[\\/]/).filter((part) => part.length >= 4)) {
      if (query.includes(segment.toLowerCase())) score += 2;
    }

    return score;
  }

  _isEntryStale(entry) {
    const resolved = path.resolve(process.cwd(), entry.path);
    if (!fs.existsSync(resolved)) return true;
    try {
      const content = this._readTextFile(resolved);
      return hashContent(content) !== entry.hash;
    } catch {
      return true;
    }
  }

  _readStore() {
    try {
      if (!fs.existsSync(BRIEFS_FILE)) return { entries: [] };
      const parsed = JSON.parse(fs.readFileSync(BRIEFS_FILE, 'utf8'));
      return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
    } catch {
      return { entries: [] };
    }
  }

  _writeStore(store) {
    fs.mkdirSync(path.dirname(BRIEFS_FILE), { recursive: true });
    fs.writeFileSync(BRIEFS_FILE, JSON.stringify(store, null, 2));
  }

  _resolveFilePath(filePath) {
    const resolved = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`הקובץ לא נמצא: ${filePath}`);
    }
    if (!fs.statSync(resolved).isFile()) {
      throw new Error(`הנתיב אינו קובץ: ${filePath}`);
    }
    return resolved;
  }

  _normalizeProjectPath(filePath) {
    const resolved = path.resolve(process.cwd(), filePath);
    const relative = path.relative(process.cwd(), resolved);
    return relative && !relative.startsWith('..') ? relative : resolved;
  }

  _readTextFile(filePath) {
    const buffer = fs.readFileSync(filePath);
    if (buffer.includes(0)) {
      throw new Error(`הקובץ נראה בינארי ולא מתאים ל-brief: ${filePath}`);
    }
    return buffer.toString('utf8');
  }
}
