/**
 * Cursor Adapter
 * Manages .cursorrules file in the project directory.
 * Provides clipboard-based translation helper for Cursor users.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Interceptor } from '../core/interceptor.js';
import { loadConfig } from '../core/config.js';

export class CursorAdapter {
  constructor() {
    this.config = loadConfig();
    this.interceptor = new Interceptor(this.config);
    this.rulesFile = path.join(process.cwd(), '.cursorrules');
  }

  /**
   * Translate Hebrew text and copy the English result to clipboard.
   * Usage: cc-translate "תקן את הבאג בקובץ auth.ts"
   */
  async translateToClipboard(hebrewText) {
    const translated = await this.interceptor.translate(hebrewText);
    this.copyToClipboard(translated);
    console.log(`\n  ✅ תורגם והועתק ללוח:\n  "${translated}"\n`);
    console.log('  הדבק (Ctrl+V) בשורת הצ\'אט של Cursor.\n');
    return translated;
  }

  copyToClipboard(text) {
    try {
      if (process.platform === 'darwin') {
        execSync(`echo "${text.replace(/"/g, '\\"')}" | pbcopy`);
      } else if (process.platform === 'linux') {
        execSync(`echo "${text.replace(/"/g, '\\"')}" | xclip -selection clipboard 2>/dev/null || echo "${text}" | xsel --clipboard --input 2>/dev/null`);
      } else if (process.platform === 'win32') {
        execSync(`echo ${text} | clip`);
      }
    } catch {
      // Clipboard copy failed silently — text is still printed
    }
  }

  /**
   * Read current .cursorrules and compress it (remove duplicates, trim whitespace).
   * Useful to run periodically to keep the rules file lean.
   */
  compressRules() {
    if (!fs.existsSync(this.rulesFile)) {
      console.log('  ℹ️  לא נמצא קובץ .cursorrules בתיקייה הנוכחית.');
      return;
    }

    const content = fs.readFileSync(this.rulesFile, 'utf8');
    const lines = content.split('\n');

    // Remove duplicate lines and empty lines (keep one empty line between sections)
    const seen = new Set();
    const compressed = [];
    let lastWasEmpty = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (!lastWasEmpty) compressed.push('');
        lastWasEmpty = true;
        continue;
      }
      lastWasEmpty = false;
      if (!seen.has(trimmed)) {
        seen.add(trimmed);
        compressed.push(line);
      }
    }

    const original = content.length;
    const result = compressed.join('\n');
    fs.writeFileSync(this.rulesFile, result);

    const saved = original - result.length;
    console.log(`  ✅ .cursorrules דוחס: חסכנו ${saved} תווים (${Math.round(saved / 4)} טוקנים בקירוב)`);
  }

  /**
   * Append a new rule to .cursorrules (avoids duplicates).
   */
  addRule(rule) {
    const content = fs.existsSync(this.rulesFile)
      ? fs.readFileSync(this.rulesFile, 'utf8')
      : '';

    if (content.includes(rule.trim())) {
      console.log('  ℹ️  הכלל כבר קיים ב-.cursorrules');
      return;
    }

    fs.appendFileSync(this.rulesFile, `\n${rule}\n`);
    console.log('  ✅ כלל חדש נוסף ל-.cursorrules');
  }
}
