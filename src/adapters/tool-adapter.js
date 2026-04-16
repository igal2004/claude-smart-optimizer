/**
 * CCSO Tool Adapter — Generic layer for all AI coding tools
 *
 * Supported tools:
 *   claude   — Anthropic Claude Code (CLI)
 *   codex    — OpenAI Codex CLI (open source)
 *   cursor   — Cursor IDE (rules file + clipboard)
 *   windsurf — Windsurf IDE (rules file + clipboard)
 *   generic  — Any other tool (clipboard + rules file only)
 *
 * Each adapter exposes a common interface:
 *   - getRulesFilePath()   → path to the tool's rules/context file
 *   - getMcpConfigPath()   → path to the tool's MCP config file (if supported)
 *   - supportsCliWrap()    → true if we can intercept stdin/stdout
 *   - supportsClipboard()  → true if clipboard injection is the fallback
 *   - launch(args)         → spawn the underlying tool process
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { execSync } from 'child_process';

// ── Tool Definitions ──────────────────────────────────────────────────────────

const TOOLS = {
  claude: {
    name: 'Claude Code',
    commands: ['claude'],
    rulesFile: 'CLAUDE.md',
    globalRulesFile: path.join(os.homedir(), 'CLAUDE.md'),
    mcpConfig: path.join(os.homedir(), '.claude', 'claude_desktop_config.json'),
    supportsCliWrap: true,
    supportsClipboard: false,
    detect: () => {
      try { execSync('which claude', { stdio: 'ignore' }); return true; } catch { return false; }
    }
  },
  codex: {
    name: 'Codex CLI',
    commands: ['codex'],
    rulesFile: 'AGENTS.md',           // Codex uses AGENTS.md
    globalRulesFile: path.join(os.homedir(), 'AGENTS.md'),
    mcpConfig: path.join(os.homedir(), '.codex', 'config.json'),
    supportsCliWrap: true,
    supportsClipboard: false,
    detect: () => {
      try { execSync('which codex', { stdio: 'ignore' }); return true; } catch { return false; }
    }
  },
  cursor: {
    name: 'Cursor',
    commands: ['cursor'],
    rulesFile: '.cursorrules',
    globalRulesFile: path.join(os.homedir(), '.cursor', 'rules'),
    mcpConfig: path.join(os.homedir(), '.cursor', 'mcp.json'),
    supportsCliWrap: false,           // GUI app — cannot intercept
    supportsClipboard: true,          // Clipboard injection as fallback
    detect: () => {
      const paths = [
        '/Applications/Cursor.app',
        path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'cursor', 'Cursor.exe'),
        '/usr/bin/cursor'
      ];
      return paths.some(p => fs.existsSync(p)) ||
        (() => { try { execSync('which cursor', { stdio: 'ignore' }); return true; } catch { return false; } })();
    }
  },
  windsurf: {
    name: 'Windsurf',
    commands: ['windsurf'],
    rulesFile: '.windsurfrules',
    globalRulesFile: path.join(os.homedir(), '.codeium', 'windsurf', 'memories', 'global_rules.md'),
    mcpConfig: path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json'),
    supportsCliWrap: false,
    supportsClipboard: true,
    detect: () => {
      const paths = [
        '/Applications/Windsurf.app',
        path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Windsurf', 'Windsurf.exe')
      ];
      return paths.some(p => fs.existsSync(p)) ||
        (() => { try { execSync('which windsurf', { stdio: 'ignore' }); return true; } catch { return false; } })();
    }
  },
  generic: {
    name: 'Generic AI Tool',
    commands: [],
    rulesFile: 'AI_RULES.md',
    globalRulesFile: path.join(os.homedir(), 'AI_RULES.md'),
    mcpConfig: null,
    supportsCliWrap: false,
    supportsClipboard: true,
    detect: () => false
  }
};

// ── Auto-detect installed tools ───────────────────────────────────────────────

export function detectInstalledTools() {
  const found = [];
  for (const [key, tool] of Object.entries(TOOLS)) {
    if (key === 'generic') continue;
    if (tool.detect()) found.push(key);
  }
  return found.length > 0 ? found : ['generic'];
}

// ── Get adapter for a specific tool ──────────────────────────────────────────

export function getAdapter(toolKey) {
  const tool = TOOLS[toolKey];
  if (!tool) throw new Error(`Unknown tool: ${toolKey}`);

  return {
    key: toolKey,
    ...tool,

    /** Path to the local rules file in the current project */
    getRulesFilePath(cwd = process.cwd()) {
      return path.join(cwd, tool.rulesFile);
    },

    /** Path to the global rules file */
    getGlobalRulesFilePath() {
      return tool.globalRulesFile;
    },

    /** Path to MCP config (null if not supported) */
    getMcpConfigPath() {
      return tool.mcpConfig;
    },

    /** Read current rules file content */
    readRules(cwd = process.cwd()) {
      const local  = path.join(cwd, tool.rulesFile);
      const global = tool.globalRulesFile;
      let content = '';
      if (fs.existsSync(global)) content += fs.readFileSync(global, 'utf8') + '\n\n';
      if (fs.existsSync(local))  content += fs.readFileSync(local, 'utf8');
      return content;
    },

    /** Write/update the local rules file */
    writeRules(content, cwd = process.cwd()) {
      const filePath = path.join(cwd, tool.rulesFile);
      fs.writeFileSync(filePath, content, 'utf8');
      return filePath;
    },

    /** Append a handoff note to the local rules file */
    appendHandoff(note, cwd = process.cwd()) {
      const filePath = path.join(cwd, tool.rulesFile);
      const timestamp = new Date().toLocaleString('he-IL');
      const entry = `\n## סשן ${timestamp}\n${note}\n`;
      if (fs.existsSync(filePath)) {
        fs.appendFileSync(filePath, entry);
      } else {
        fs.writeFileSync(filePath, entry);
      }
      return filePath;
    },

    /** Launch the underlying tool (CLI tools only) */
    launch(args = [], options = {}) {
      if (!tool.supportsCliWrap) {
        throw new Error(`${tool.name} is a GUI tool and cannot be launched via CLI wrap.`);
      }
      const cmd = tool.commands[0];
      return spawn(cmd, args, { stdio: 'inherit', ...options });
    },

    /** Copy text to clipboard (for GUI tools) */
    async copyToClipboard(text) {
      const { default: clipboardy } = await import('clipboardy').catch(() => ({ default: null }));
      if (clipboardy) {
        await clipboardy.write(text);
        return true;
      }
      // Fallback: use pbcopy (Mac) or xclip (Linux)
      try {
        const cmd = process.platform === 'darwin' ? 'pbcopy' : 'xclip -selection clipboard';
        const proc = spawn(cmd, [], { stdio: ['pipe', 'ignore', 'ignore'], shell: true });
        proc.stdin.write(text);
        proc.stdin.end();
        return true;
      } catch {
        return false;
      }
    }
  };
}

// ── Get all tool definitions (for installer/UI) ───────────────────────────────

export function getAllTools() {
  return TOOLS;
}

export function getToolInfo(toolKey) {
  return TOOLS[toolKey] || null;
}
