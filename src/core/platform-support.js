import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function commandExists(command) {
  try {
    await execFileAsync('which', [command]);
    return true;
  } catch {
    return false;
  }
}

function pathExists(...paths) {
  return paths.some((entry) => fs.existsSync(entry));
}

function hasVscodeExtension(prefixes = []) {
  const home = os.homedir();
  const candidates = [
    path.join(home, '.vscode', 'extensions'),
    path.join(home, '.cursor', 'extensions'),
  ];

  return candidates.some((dir) => {
    if (!fs.existsSync(dir)) return false;
    return fs.readdirSync(dir).some((entry) => {
      const lower = entry.toLowerCase();
      return prefixes.some((prefix) => lower.startsWith(prefix.toLowerCase()));
    });
  });
}

const PLATFORM_CATALOG = [
  {
    id: 'claude',
    icon: '🤖',
    name: 'Claude Code',
    supportLevel: 'full-backend',
    supportLabel: 'Full backend',
    dashboardGroup: 'measured-runtime',
    dashboardGroupLabel: 'Measured runtime',
    savingsMode: 'direct-measured',
    savingsLabel: 'Measured savings',
    description: 'CCSO can execute prompts through the Claude CLI, estimate spend/savings, open the dashboard chat, and manage Claude MCP/project files.',
    limitations: 'Usage stats only cover prompts that CCSO sends itself.',
    capabilities: ['Backend execution', 'Usage stats', 'Dashboard chat', 'MCP config', 'Project rules'],
    detect: async () => commandExists('claude'),
  },
  {
    id: 'cursor',
    icon: '🖱️',
    name: 'Cursor',
    supportLevel: 'rules-mcp',
    supportLabel: 'Project rules + MCP',
    dashboardGroup: 'assisted-integration',
    dashboardGroupLabel: 'Assisted, not measured',
    savingsMode: 'assisted-unmeasured',
    savingsLabel: 'Can help, not measured',
    description: 'CCSO can write `.cursorrules` and Cursor MCP config, and it includes a small clipboard helper.',
    limitations: 'CCSO does not intercept Cursor chats or measure Cursor token usage.',
    capabilities: ['Project rules', 'MCP config', 'Clipboard helper'],
    detect: async () => {
      const home = os.homedir();
      return commandExists('cursor').then((found) => found || pathExists(
        '/Applications/Cursor.app',
        path.join(home, 'Applications', 'Cursor.app'),
        path.join(home, '.cursor'),
        path.join(home, 'Library', 'Application Support', 'Cursor'),
      ));
    },
  },
  {
    id: 'windsurf',
    icon: '🏄',
    name: 'Windsurf',
    supportLevel: 'rules-mcp',
    supportLabel: 'Project rules + MCP',
    dashboardGroup: 'assisted-integration',
    dashboardGroupLabel: 'Assisted, not measured',
    savingsMode: 'assisted-unmeasured',
    savingsLabel: 'Can help, not measured',
    description: 'CCSO can write `.windsurfrules` and Windsurf MCP config.',
    limitations: 'CCSO does not intercept Windsurf chats or measure Windsurf token usage.',
    capabilities: ['Project rules', 'MCP config'],
    detect: async () => {
      const home = os.homedir();
      return commandExists('windsurf').then((found) => found || pathExists(
        '/Applications/Windsurf.app',
        path.join(home, 'Applications', 'Windsurf.app'),
      ));
    },
  },
  {
    id: 'copilot',
    icon: '💙',
    name: 'GitHub Copilot',
    supportLevel: 'instruction-file',
    supportLabel: 'Instruction file only',
    dashboardGroup: 'export-target',
    dashboardGroupLabel: 'Instruction / export target',
    savingsMode: 'no-runtime-savings',
    savingsLabel: 'No runtime savings path',
    description: 'CCSO can generate `.github/copilot-instructions.md` for Copilot-aware editors.',
    limitations: 'No IDE control, prompt interception, or usage statistics.',
    capabilities: ['Project instructions'],
    detect: async () => hasVscodeExtension(['github.copilot', 'github.copilot-chat']),
  },
  {
    id: 'gemini',
    icon: '✨',
    name: 'Gemini Code Assist',
    supportLevel: 'instruction-file',
    supportLabel: 'Instruction file only',
    dashboardGroup: 'export-target',
    dashboardGroupLabel: 'Instruction / export target',
    savingsMode: 'no-runtime-savings',
    savingsLabel: 'No runtime savings path',
    description: 'CCSO can generate `.ccso_instruction` text for Gemini Code Assist customization.',
    limitations: 'No live prompt wrapping, IDE control, or billing statistics.',
    capabilities: ['Instruction text'],
    detect: async () => hasVscodeExtension(['google.geminicodeassist', 'googlecloudtools.cloudcode', 'google.cloudcode']),
  },
  {
    id: 'firebase-studio',
    icon: '🔥',
    name: 'Firebase Studio / Project IDX',
    supportLevel: 'project-config',
    supportLabel: 'Project config only',
    dashboardGroup: 'export-target',
    dashboardGroupLabel: 'Project config target',
    savingsMode: 'no-runtime-savings',
    savingsLabel: 'No runtime savings path',
    description: 'CCSO can scaffold `.idx/dev.nix` and Gemini customization text for web IDE projects.',
    limitations: 'No local app detection, live prompt interception, or usage statistics.',
    capabilities: ['Project config', 'Instruction text'],
    availability: 'available',
    availabilityLabel: 'Available via ccso inject',
  },
  {
    id: 'notebooklm',
    icon: '📒',
    name: 'NotebookLM Bridge',
    supportLevel: 'companion-bridge',
    supportLabel: 'Companion bridge',
    dashboardGroup: 'utility',
    dashboardGroupLabel: 'Utility / bridge',
    savingsMode: 'not-applicable',
    savingsLabel: 'Not a coding runtime',
    description: 'CCSO includes separate `ccso notebooklm ...` commands for NotebookLM login, list, ask, and save flows.',
    limitations: 'This is a companion utility, not an inline coding backend.',
    capabilities: ['Bridge commands'],
    detect: async () => {
      const sessionPath = path.join(os.homedir(), '.ccso', 'notebooklm_session.json');
      return fs.existsSync(sessionPath) ? true : null;
    },
    availabilityLabel: 'Available in CCSO',
  },
];

function mapAvailability(result, fallbackLabel = 'Available in CCSO') {
  if (result === true) {
    return { availability: 'detected', availabilityLabel: 'Detected on this machine' };
  }
  if (result === false) {
    return { availability: 'not-detected', availabilityLabel: 'Not detected' };
  }
  return { availability: 'available', availabilityLabel: fallbackLabel };
}

export async function getSupportedPlatformStatuses() {
  const statuses = [];

  for (const platform of PLATFORM_CATALOG) {
    const detection = platform.detect ? await platform.detect() : platform.availability;
    const { availability, availabilityLabel } = mapAvailability(
      detection,
      platform.availabilityLabel,
    );

    statuses.push({
      id: platform.id,
      icon: platform.icon,
      name: platform.name,
      supportLevel: platform.supportLevel,
      supportLabel: platform.supportLabel,
      dashboardGroup: platform.dashboardGroup,
      dashboardGroupLabel: platform.dashboardGroupLabel,
      savingsMode: platform.savingsMode,
      savingsLabel: platform.savingsLabel,
      description: platform.description,
      limitations: platform.limitations,
      capabilities: platform.capabilities,
      availability,
      availabilityLabel,
    });
  }

  return statuses;
}
