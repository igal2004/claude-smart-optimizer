/**
 * Prompt Response Cache
 * Saves and retrieves Claude responses by prompt hash.
 * TTL: 24 hours by default.
 *
 * Cache lives in: ~/.config/claude-smart-optimizer/cache/<hash>.json
 */

import * as fs   from 'fs';
import * as path from 'path';
import * as os   from 'os';
import * as crypto from 'crypto';

const CACHE_DIR = path.join(os.homedir(), '.config', 'claude-smart-optimizer', 'cache');
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class PromptCache {
  constructor(config) {
    this.enabled = config.get('promptCache') !== false;
    this.ttlMs   = (config.get('cacheTTLHours') || 24) * 60 * 60 * 1000;
    if (this.enabled) {
      try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch { /* ignore */ }
    }
  }

  /**
   * Get a cached response for a prompt. Returns null if not found or expired.
   * @param {string} prompt
   * @param {string} model
   * @returns {{ response: string, model: string, savedAt: string } | null}
   */
  get(prompt, model = 'default') {
    if (!this.enabled) return null;
    const file = this._file(prompt, model);
    try {
      if (!fs.existsSync(file)) return null;
      const entry = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Date.now() - new Date(entry.savedAt).getTime() > this.ttlMs) {
        fs.unlinkSync(file); // expired — clean up
        return null;
      }
      return entry;
    } catch {
      return null;
    }
  }

  /**
   * Save a response to cache.
   * @param {string} prompt
   * @param {string} response
   * @param {string} model
   */
  set(prompt, response, model = 'default') {
    if (!this.enabled) return;
    // Only cache short-to-medium responses to avoid bloating disk
    if (response.length > 8000) return;
    const file = this._file(prompt, model);
    try {
      const entry = { prompt: prompt.slice(0, 200), response, model, savedAt: new Date().toISOString() };
      fs.writeFileSync(file, JSON.stringify(entry));
    } catch { /* ignore */ }
  }

  /**
   * Clear all cached entries.
   */
  clear() {
    try {
      const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
      for (const f of files) fs.unlinkSync(path.join(CACHE_DIR, f));
      return files.length;
    } catch {
      return 0;
    }
  }

  /**
   * Count cache entries.
   */
  size() {
    try { return fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json')).length; } catch { return 0; }
  }

  _file(prompt, model) {
    const hash = crypto.createHash('sha256').update(model + '::' + prompt.trim()).digest('hex').slice(0, 16);
    return path.join(CACHE_DIR, `${hash}.json`);
  }
}
