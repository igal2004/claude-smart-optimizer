/**
 * Prompt History
 * Every prompt is saved to a JSONL file.
 * Supports /history command and up/down arrow navigation in the REPL.
 *
 * Storage: ~/.config/claude-smart-optimizer/prompt-history.jsonl
 */

import * as fs   from 'fs';
import * as path from 'path';
import * as os   from 'os';

const HISTORY_FILE = path.join(os.homedir(), '.config', 'claude-smart-optimizer', 'prompt-history.jsonl');
const MAX_ENTRIES  = 500;

export class PromptHistory {
  constructor() {
    this._cache  = null;
    this._cursor = -1; // for up/down navigation
  }

  /** Save a prompt (ignores built-in /commands) */
  add(prompt) {
    if (!prompt?.trim() || prompt.startsWith('/')) return;
    const entry = {
      ts:  new Date().toISOString(),
      cwd: process.cwd(),
      text: prompt.trim(),
    };
    try {
      fs.appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n');
      this._cache = null;
      this._cursor = -1;
    } catch { /* ignore write errors */ }
  }

  /** Load last N prompts (newest first) */
  load(limit = MAX_ENTRIES) {
    if (this._cache) return this._cache;
    try {
      const lines = fs.readFileSync(HISTORY_FILE, 'utf8').trim().split('\n').filter(Boolean);
      this._cache = lines.slice(-limit).reverse().map(l => JSON.parse(l));
    } catch {
      this._cache = [];
    }
    return this._cache;
  }

  /** Search history by keyword */
  search(query) {
    const q = query.toLowerCase();
    return this.load().filter(e => e.text.toLowerCase().includes(q)).slice(0, 15);
  }

  /** Format history for display */
  print(limit = 25) {
    const entries = this.load(limit);
    if (!entries.length) return '\n  אין היסטוריה עדיין.\n';
    const lines = entries.map((e, i) => {
      const d = new Date(e.ts);
      const time = d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const text = e.text.length > 70 ? e.text.slice(0, 70) + '…' : e.text;
      return `  ${String(i + 1).padStart(3)}.  [${time}]  ${text}`;
    });
    return '\n' + lines.join('\n') + '\n';
  }

  /** Get previous prompt (for up-arrow) */
  prev() {
    const entries = this.load();
    if (!entries.length) return null;
    this._cursor = Math.min(this._cursor + 1, entries.length - 1);
    return entries[this._cursor]?.text || null;
  }

  /** Get next prompt (for down-arrow) */
  next() {
    this._cursor = Math.max(this._cursor - 1, -1);
    if (this._cursor === -1) return '';
    return this.load()[this._cursor]?.text || '';
  }

  resetCursor() {
    this._cursor = -1;
  }

  /** Handle /history REPL commands */
  handleCommand(input) {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/history')) return { handled: false };

    const rest = trimmed.replace('/history', '').trim();

    if (!rest) {
      return { handled: true, message: this.print() };
    }

    if (rest.startsWith('search ')) {
      const q = rest.slice(7);
      const results = this.search(q);
      if (!results.length) return { handled: true, message: `\n  לא נמצאו תוצאות עבור: "${q}"\n` };
      const lines = results.map((e, i) => {
        const time = new Date(e.ts).toLocaleString('he-IL', { day: '2-digit', month: '2-digit' });
        return `  ${i + 1}. [${time}] ${e.text.slice(0, 80)}`;
      });
      return { handled: true, message: '\n' + lines.join('\n') + '\n' };
    }

    return { handled: true, message: '\n  שימוש: /history  או  /history search <מילת חיפוש>\n' };
  }
}
