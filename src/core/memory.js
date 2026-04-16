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
import * as os   from 'os';

const MEMORY_DIR = path.join(os.homedir(), '.config', 'claude-smart-optimizer', 'memory');

export class Memory {
  constructor(config) {
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

  /**
   * Build context prefix to inject into every prompt.
   * Returns empty string if no memory or disabled.
   */
  buildContextPrefix() {
    if (!this.enabled) return '';
    const projectFacts = this._readFile(this._projectFile());
    const globalFacts  = this._readFile(this._globalFile());
    if (!projectFacts && !globalFacts) return '';

    const parts = [];
    if (globalFacts)  parts.push(`[Global context]\n${globalFacts}`);
    if (projectFacts) parts.push(`[Project context]\n${projectFacts}`);
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
