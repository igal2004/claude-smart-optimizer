/**
 * Dynamic Skills Loader
 * Loads Claude Code Skills and MCP connectors ONLY when needed.
 *
 * Instead of loading all skills globally (which wastes tokens on every prompt),
 * this module detects intent from the user's input and activates only the
 * relevant skill/connector for that specific request.
 *
 * Skills are defined in: ~/.config/claude-smart-optimizer/skills/
 * Each skill is a JSON file with: { name, triggers, mcpServer, systemPrompt }
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SKILLS_DIR = path.join(os.homedir(), '.config', 'claude-smart-optimizer', 'skills');

// Built-in skill trigger patterns
const BUILT_IN_TRIGGERS = [
  {
    name: 'github',
    triggers: ['github', 'pull request', 'pr', 'issue', 'repository', 'גיטהאב', 'פול ריקוסט'],
    description: 'GitHub MCP connector'
  },
  {
    name: 'database',
    triggers: ['database', 'sql', 'query', 'table', 'migration', 'db', 'בסיס נתונים', 'שאילתה'],
    description: 'Database MCP connector'
  },
  {
    name: 'filesystem',
    triggers: ['read file', 'write file', 'list directory', 'קרא קובץ', 'כתוב קובץ'],
    description: 'Filesystem MCP connector'
  },
  {
    name: 'web',
    triggers: ['fetch url', 'scrape', 'http request', 'api call', 'endpoint'],
    description: 'Web/HTTP MCP connector'
  }
];

export class SkillsLoader {
  constructor(config) {
    this.config = config;
    this.skills = this.loadSkillDefinitions();
  }

  loadSkillDefinitions() {
    const skills = [...BUILT_IN_TRIGGERS];

    // Load user-defined skills from config dir
    if (fs.existsSync(SKILLS_DIR)) {
      const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const skill = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, file), 'utf8'));
          skills.push(skill);
        } catch {
          // Skip malformed skill files
        }
      }
    }

    return skills;
  }

  /**
   * Detect which skills are needed for the given input.
   * Returns an array of skill names that should be activated.
   */
  detectNeededSkills(input) {
    const lower = input.toLowerCase();
    const needed = [];

    for (const skill of this.skills) {
      const triggered = skill.triggers.some(trigger => lower.includes(trigger.toLowerCase()));
      if (triggered) {
        needed.push(skill.name);
      }
    }

    return needed;
  }

  /**
   * Build the --mcp flags for the backend command based on needed skills.
   * Returns an array of additional CLI arguments.
   */
  buildMcpArgs(neededSkills) {
    if (neededSkills.length === 0) return [];
    // Claude Code supports: --mcp-server <name>
    return neededSkills.flatMap(skill => ['--mcp-server', skill]);
  }

  /**
   * Log which skills were activated (for transparency).
   */
  logActivation(neededSkills) {
    if (neededSkills.length > 0) {
      console.log(`  [CCSO] 🔌 טוען סקילים: ${neededSkills.join(', ')}`);
    }
  }

  /**
   * Add a new user-defined skill.
   */
  addSkill(skill) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
    const filePath = path.join(SKILLS_DIR, `${skill.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(skill, null, 2));
    console.log(`  ✅ סקיל "${skill.name}" נוסף`);
    this.skills = this.loadSkillDefinitions(); // Reload
  }

  listSkills() {
    console.log('\n  סקילים זמינים:\n');
    for (const skill of this.skills) {
      const triggers = skill.triggers.slice(0, 3).join(', ');
      console.log(`  • ${skill.name.padEnd(15)} — מופעל כאשר: "${triggers}"...`);
    }
    console.log('');
  }
}
