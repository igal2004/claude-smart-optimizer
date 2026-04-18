#!/usr/bin/env node

/**
 * CCSO MCP Manager
 * Manage MCP (Model Context Protocol) connections for any AI coding tool.
 *
 * Usage:
 *   cc mcp list                    — show all configured MCPs
 *   cc mcp add <name>              — add a pre-built MCP integration
 *   cc mcp remove <name>           — remove an MCP integration
 *   cc mcp status                  — check which MCPs are active
 *
 * Supported primary targets: Claude Code, Cursor, Windsurf
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { detectInstalledTools, getAdapter } from '../src/adapters/tool-adapter.js';

const c = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
};

// ── Pre-built MCP catalog ─────────────────────────────────────────────────────

const MCP_CATALOG = {
  github: {
    name: 'GitHub',
    description: 'גישה ל-Issues, PRs, קוד, ו-Repos ישירות מקלוד',
    icon: '🐙',
    package: '@modelcontextprotocol/server-github',
    envRequired: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    envInstructions: {
      GITHUB_PERSONAL_ACCESS_TOKEN: 'צור Token ב: https://github.com/settings/tokens (הרשאות: repo, read:org)'
    },
    config: (env) => ({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: env.GITHUB_PERSONAL_ACCESS_TOKEN }
    })
  },
  notion: {
    name: 'Notion',
    description: 'שליפת דפים, מסדי נתונים וסיכומים מ-Notion',
    icon: '📝',
    package: '@modelcontextprotocol/server-notion',
    envRequired: ['NOTION_API_KEY'],
    envInstructions: {
      NOTION_API_KEY: 'צור Integration ב: https://www.notion.so/my-integrations'
    },
    config: (env) => ({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-notion'],
      env: { NOTION_API_KEY: env.NOTION_API_KEY }
    })
  },
  filesystem: {
    name: 'Filesystem',
    description: 'גישה מבוקרת לתיקיות ספציפיות (בלי לסרוק הכל)',
    icon: '📁',
    package: '@modelcontextprotocol/server-filesystem',
    envRequired: [],
    envInstructions: {},
    config: (env, extraArgs = []) => ({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', ...extraArgs],
      env: {}
    })
  },
  brave_search: {
    name: 'Brave Search',
    description: 'חיפוש אינטרנט חכם — קלוד מחפש רק כשצריך',
    icon: '🔍',
    package: '@modelcontextprotocol/server-brave-search',
    envRequired: ['BRAVE_API_KEY'],
    envInstructions: {
      BRAVE_API_KEY: 'קבל מפתח API חינמי ב: https://brave.com/search/api/'
    },
    config: (env) => ({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: { BRAVE_API_KEY: env.BRAVE_API_KEY }
    })
  },
  sqlite: {
    name: 'SQLite',
    description: 'גישה לבסיסי נתונים SQLite מקומיים',
    icon: '🗄️',
    package: '@modelcontextprotocol/server-sqlite',
    envRequired: [],
    envInstructions: {},
    config: (env, dbPath = '') => ({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite', dbPath],
      env: {}
    })
  },
  memory: {
    name: 'Memory (זיכרון מתמיד)',
    description: 'מאפשר לקלוד לזכור מידע בין סשנים שונים',
    icon: '🧠',
    package: '@modelcontextprotocol/server-memory',
    envRequired: [],
    envInstructions: {},
    config: () => ({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      env: {}
    })
  }
};

// ── Config file helpers ───────────────────────────────────────────────────────

function loadMcpConfig(configPath) {
  if (!configPath || !fs.existsSync(configPath)) return { mcpServers: {} };
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return { mcpServers: {} };
  }
}

function saveMcpConfig(configPath, config) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// ── CCSO internal MCP registry (tool-agnostic) ────────────────────────────────

const CCSO_MCP_REGISTRY = path.join(os.homedir(), '.ccso', 'mcp_registry.json');

function loadRegistry() {
  if (!fs.existsSync(CCSO_MCP_REGISTRY)) return {};
  try { return JSON.parse(fs.readFileSync(CCSO_MCP_REGISTRY, 'utf8')); } catch { return {}; }
}

function saveRegistry(data) {
  const dir = path.dirname(CCSO_MCP_REGISTRY);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CCSO_MCP_REGISTRY, JSON.stringify(data, null, 2));
}

// ── Ask helper ────────────────────────────────────────────────────────────────

function ask(rl, question, defaultVal = '') {
  const hint = defaultVal ? c.dim(` [${defaultVal}]`) : '';
  return new Promise(resolve => {
    rl.question(`  ${question}${hint}: `, ans => resolve(ans.trim() || defaultVal));
  });
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdList() {
  const registry = loadRegistry();
  const installed = Object.keys(registry);

  console.log('');
  console.log(c.bold(c.cyan('  📦 MCP Catalog — כלים זמינים להתקנה\n')));

  for (const [key, mcp] of Object.entries(MCP_CATALOG)) {
    const isInstalled = installed.includes(key);
    const status = isInstalled ? c.green('✅ מותקן') : c.dim('○ לא מותקן');
    console.log(`  ${mcp.icon}  ${c.bold(mcp.name.padEnd(20))} ${status}`);
    console.log(`     ${c.dim(mcp.description)}`);
    console.log('');
  }

  if (installed.length > 0) {
    console.log(c.bold('  🔌 MCPs פעילים:\n'));
    for (const key of installed) {
      const mcp = MCP_CATALOG[key];
      const tools = registry[key]?.tools || [];
      console.log(`  ${mcp?.icon || '•'} ${c.bold(key)} → מוגדר ב: ${tools.join(', ')}`);
    }
    console.log('');
  }

  console.log(c.dim('  הוסף MCP: cc mcp add <שם>   |   הסר: cc mcp remove <שם>'));
  console.log('');
}

async function cmdAdd(mcpKey) {
  if (!mcpKey) {
    console.log(c.red('\n  שגיאה: ציין שם MCP. לדוגמה: cc mcp add github\n'));
    console.log('  MCPs זמינים: ' + Object.keys(MCP_CATALOG).join(', '));
    return;
  }

  const mcp = MCP_CATALOG[mcpKey];
  if (!mcp) {
    console.log(c.red(`\n  שגיאה: "${mcpKey}" לא נמצא ב-Catalog.\n`));
    console.log('  MCPs זמינים: ' + Object.keys(MCP_CATALOG).join(', '));
    return;
  }

  console.log('');
  console.log(c.bold(c.cyan(`  ${mcp.icon} הוספת MCP: ${mcp.name}`)));
  console.log(c.dim(`  ${mcp.description}\n`));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const envValues = {};

  // Collect required env vars
  for (const envKey of mcp.envRequired) {
    const instruction = mcp.envInstructions[envKey] || '';
    if (instruction) console.log(c.yellow(`  📌 ${instruction}\n`));
    const val = await ask(rl, `הזן ${envKey}`, '');
    if (!val) {
      console.log(c.red(`\n  ביטול — ${envKey} נדרש.\n`));
      rl.close();
      return;
    }
    envValues[envKey] = val;
  }

  // Detect which tools are installed
  const installedTools = detectInstalledTools();
  console.log(c.dim(`\n  כלים שזוהו: ${installedTools.join(', ')}`));

  const configuredTools = [];

  for (const toolKey of installedTools) {
    const adapter = getAdapter(toolKey);
    const configPath = adapter.getMcpConfigPath();

    if (!configPath) {
      console.log(c.dim(`  ⚠️  ${adapter.name}: אין תמיכה ב-MCP config — מדלג`));
      continue;
    }

    const config = loadMcpConfig(configPath);
    if (!config.mcpServers) config.mcpServers = {};

    config.mcpServers[mcpKey] = mcp.config(envValues);
    saveMcpConfig(configPath, config);
    configuredTools.push(toolKey);
    console.log(c.green(`  ✅ הוגדר ב-${adapter.name}: ${configPath}`));
  }

  // Save to CCSO registry
  const registry = loadRegistry();
  registry[mcpKey] = { tools: configuredTools, addedAt: new Date().toISOString(), env: Object.keys(envValues) };
  saveRegistry(registry);

  rl.close();

  console.log('');
  console.log(c.bold(c.green(`  🎉 ${mcp.name} הוגדר בהצלחה!`)));
  console.log(c.dim(`  הפעל מחדש את הכלי שלך כדי שהשינויים ייכנסו לתוקף.\n`));
}

async function cmdRemove(mcpKey) {
  if (!mcpKey) {
    console.log(c.red('\n  שגיאה: ציין שם MCP. לדוגמה: cc mcp remove github\n'));
    return;
  }

  const registry = loadRegistry();
  if (!registry[mcpKey]) {
    console.log(c.yellow(`\n  "${mcpKey}" לא נמצא ברשימת ה-MCPs המותקנים.\n`));
    return;
  }

  const installedTools = detectInstalledTools();
  for (const toolKey of installedTools) {
    const adapter = getAdapter(toolKey);
    const configPath = adapter.getMcpConfigPath();
    if (!configPath || !fs.existsSync(configPath)) continue;

    const config = loadMcpConfig(configPath);
    if (config.mcpServers && config.mcpServers[mcpKey]) {
      delete config.mcpServers[mcpKey];
      saveMcpConfig(configPath, config);
      console.log(c.green(`  ✅ הוסר מ-${adapter.name}`));
    }
  }

  delete registry[mcpKey];
  saveRegistry(registry);

  console.log(c.bold(c.green(`\n  🗑️  ${mcpKey} הוסר בהצלחה.\n`)));
}

async function cmdStatus() {
  const registry = loadRegistry();
  const installedTools = detectInstalledTools();

  console.log('');
  console.log(c.bold(c.cyan('  🔌 סטטוס MCP\n')));
  console.log(`  כלים שזוהו: ${installedTools.map(t => c.bold(t)).join(', ')}\n`);

  for (const toolKey of installedTools) {
    const adapter = getAdapter(toolKey);
    const configPath = adapter.getMcpConfigPath();
    console.log(`  ${c.bold(adapter.name)}:`);

    if (!configPath) {
      console.log(c.dim('    אין תמיכה ב-MCP config\n'));
      continue;
    }

    const config = loadMcpConfig(configPath);
    const servers = config.mcpServers || {};
    const keys = Object.keys(servers);

    if (keys.length === 0) {
      console.log(c.dim('    אין MCPs מוגדרים\n'));
    } else {
      for (const k of keys) {
        const catalogEntry = MCP_CATALOG[k];
        const icon = catalogEntry?.icon || '•';
        console.log(`    ${icon} ${c.bold(k)}`);
      }
      console.log('');
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const [,, , subCmd, arg] = process.argv;

  switch (subCmd) {
    case 'list':
    case undefined:
      await cmdList();
      break;
    case 'add':
      await cmdAdd(arg);
      break;
    case 'remove':
    case 'rm':
      await cmdRemove(arg);
      break;
    case 'status':
      await cmdStatus();
      break;
    default:
      console.log(c.red(`\n  פקודה לא מוכרת: ${subCmd}`));
      console.log(c.dim('  שימוש: cc mcp [list|add|remove|status]\n'));
  }
}

main().catch(console.error);
