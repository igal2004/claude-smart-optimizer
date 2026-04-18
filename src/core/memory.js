/**
 * Cross-Session Memory
 * Saves key project facts between sessions and auto-injects them as context.
 *
 * Storage:
 *   Global facts  → ~/.config/claude-smart-optimizer/memory/global.md
 *   Project facts → ~/.config/claude-smart-optimizer/memory/<project-hash>.md
 *
 * REPL commands:
 *   /memory add "fact"   — save a fact about this project
 *   /memory list         — show saved facts
 *   /memory clear        — delete project memory
 *   /memory global "..."  — save a global fact (all projects)
 */

import * as fs   from 'fs';
import * as path from 'path';
import { getCCSOPath } from './storage-paths.js';
import { countTokens } from './token-utils.js';

const MEMORY_DIR = getCCSOPath('memory');
const TOKEN_BUDGET_FLOOR = 60;
const FACT_COUNT_FLOOR = 1;

export class Memory {
  constructor(config) {
    this.config = config;
    this.enabled = config.get('memoryEnabled') !== false;
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
    this._projectKey = this._getProjectKey();
  }

  _getProjectKey() {
    try {
      const cwd = process.cwd();
      return Buffer.from(cwd).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
    } catch {
      return 'default';
    }
  }

  _projectFile() {
    return path.join(MEMORY_DIR, `${this._projectKey}.md`);
  }

  _globalFile() {
    return path.join(MEMORY_DIR, 'global.md');
  }

  add(fact, isGlobal = false) {
    const file = isGlobal ? this._globalFile() : this._projectFile();
    const date = new Date().toLocaleDateString('he-IL');
    fs.appendFileSync(file, `- [${date}] ${fact.trim()}\n`);
  }

  list() {
    const projectFacts = this._readFile(this._projectFile());
    const globalFacts  = this._readFile(this._globalFile());
    if (!projectFacts && !globalFacts) return null;
    let out = '';
    if (projectFacts) out += `📁 זיכרון פרויקט:\n${projectFacts}\n`;
    if (globalFacts)  out += `🌍 זיכרון גלובלי:\n${globalFacts}`;
    return out.trim();
  }

  clear(isGlobal = false) {
    const file = isGlobal ? this._globalFile() : this._projectFile();
    try { fs.unlinkSync(file); return true; } catch { return false; }
  }

  _readFile(file) {
    try { return fs.readFileSync(file, 'utf8').trim(); } catch { return null; }
  }

  _parseFacts(text, source) {
    if (!text) return [];

    return text
      .split(/\r?\n/)
      .map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        const fact = trimmed
          .replace(/^[-*]\s*/, '')
          .replace(/^\[[^\]]+\]\s*/, '')
          .trim();

        if (!fact) return null;

        return {
          source,
          text: fact,
          index,
        };
      })
      .filter(Boolean);
  }

  _tokenize(text = '') {
    const matches = text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}._/-]*/gu) || [];
    return [...new Set(matches.filter((token) => token.length > 1))];
  }

  _isPathLike(token = '') {
    return /[./_-]/.test(token) || /\.[a-z0-9]{1,8}$/i.test(token);
  }

  _scoreFact(fact, queryTokens, queryBigrams) {
    const haystack = fact.text.toLowerCase();
    const factTokens = new Set(this._tokenize(fact.text));
    let matchScore = 0;

    for (const token of queryTokens) {
      if (factTokens.has(token)) {
        matchScore += this._isPathLike(token) ? 8 : 4;
      } else if (this._isPathLike(token) && haystack.includes(token)) {
        matchScore += 5;
      }
    }

    for (const bigram of queryBigrams) {
      if (haystack.includes(bigram)) {
        matchScore += 6;
      }
    }

    const sourceBias = fact.source === 'project' ? 1.5 : 0.5;
    const recencyBias = (fact.index + 1) / 100;

    return {
      ...fact,
      matchScore,
      score: matchScore + sourceBias + recencyBias,
    };
  }

  _selectFacts(query = '') {
    const budget = Math.max(
      TOKEN_BUDGET_FLOOR,
      Number(this.config?.get?.('memoryTokenBudget')) || TOKEN_BUDGET_FLOOR,
    );
    const maxFacts = Math.max(
      FACT_COUNT_FLOOR,
      Number(this.config?.get?.('memoryMaxFacts')) || FACT_COUNT_FLOOR,
    );

    const facts = [
      ...this._parseFacts(this._readFile(this._globalFile()), 'global'),
      ...this._parseFacts(this._readFile(this._projectFile()), 'project'),
    ];

    if (facts.length === 0) return { selected: [], queryMatched: false };

    const queryTokens = this._tokenize(query);
    const queryBigrams = [];
    for (let i = 0; i < queryTokens.length - 1; i++) {
      queryBigrams.push(`${queryTokens[i]} ${queryTokens[i + 1]}`);
    }

    const ranked = facts
      .map((fact) => this._scoreFact(fact, queryTokens, queryBigrams))
      .sort((a, b) => b.score - a.score || b.index - a.index);

    const hasMatches = ranked.some((fact) => fact.matchScore > 0);
    const pool = hasMatches ? ranked.filter((fact) => fact.matchScore > 0) : ranked;

    const selected = [];
    let usedTokens = 0;

    for (const fact of pool) {
      if (selected.length >= maxFacts) break;

      const line = `- ${fact.text}`;
      const lineTokens = countTokens(line);
      if (selected.length > 0 && usedTokens + lineTokens > budget) continue;

      selected.push(fact);
      usedTokens += lineTokens;
    }

    if (selected.length === 0 && ranked[0]) {
      selected.push(ranked[0]);
    }

    return { selected, queryMatched: hasMatches };
  }

  /**
   * Build context prefix to inject into every prompt.
   * Returns empty string if no memory or disabled.
   */
  buildContextPrefix(query = '') {
    if (!this.enabled) return '';

    const { selected, queryMatched } = this._selectFacts(query);
    if (selected.length === 0) return '';

    const globalFacts = selected.filter((fact) => fact.source === 'global');
    const projectFacts = selected.filter((fact) => fact.source === 'project');
    const labelPrefix = queryMatched ? 'Relevant' : 'Recent';
    const parts = [];

    if (globalFacts.length > 0) {
      parts.push(`[${labelPrefix} global context]\n${globalFacts.map((fact) => `- ${fact.text}`).join('\n')}`);
    }
    if (projectFacts.length > 0) {
      parts.push(`[${labelPrefix} project context]\n${projectFacts.map((fact) => `- ${fact.text}`).join('\n')}`);
    }

    return parts.join('\n') + '\n\n';
  }

  /**
   * Handle /memory REPL commands.
   * Returns { handled: bool, message: string }
   */
  handleCommand(input) {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/memory')) return { handled: false };

    const rest = trimmed.replace('/memory', '').trim();

    if (!rest || rest === 'list') {
      const mem = this.list();
      return { handled: true, message: mem ? `\n${mem}\n` : '\n  אין זיכרון שמור עדיין.\n  השתמש ב: /memory add "עובדה"\n' };
    }

    if (rest.startsWith('add ')) {
      const fact = rest.slice(4).replace(/^["']|["']$/g, '');
      this.add(fact);
      return { handled: true, message: `\n  ✅ נשמר: "${fact}"\n` };
    }

    if (rest.startsWith('global ')) {
      const fact = rest.slice(7).replace(/^["']|["']$/g, '');
      this.add(fact, true);
      return { handled: true, message: `\n  ✅ נשמר גלובלי: "${fact}"\n` };
    }

    if (rest === 'clear') {
      this.clear();
      return { handled: true, message: '\n  🗑️  זיכרון הפרויקט נמחק.\n' };
    }

    return { handled: true, message: '\n  שימוש: /memory [add "עובדה" | list | clear | global "עובדה"]\n' };
  }
}
