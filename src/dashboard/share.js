import { spawn } from 'child_process';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import {
  DASHBOARD_PORT,
  DASHBOARD_URL,
  ensureDashboardServer,
} from './control.js';

const execFileAsync = promisify(execFile);

async function commandExists(command) {
  try {
    await execFileAsync('which', [command]);
    return true;
  } catch {
    return false;
  }
}

export function extractTunnelUrl(output = '') {
  const match = output.match(/https:\/\/[a-zA-Z0-9.-]+\.(?:ngrok-free\.app|ngrok\.app|trycloudflare\.com|loca\.lt|localtunnel\.me)\b\S*/);
  return match ? match[0] : null;
}

async function getTunnelCommand() {
  if (await commandExists('ngrok')) {
    return {
      name: 'ngrok',
      command: 'ngrok',
      args: ['http', String(DASHBOARD_PORT), '--log=stdout'],
    };
  }

  if (await commandExists('cloudflared')) {
    return {
      name: 'cloudflared',
      command: 'cloudflared',
      args: ['tunnel', '--url', DASHBOARD_URL, '--no-autoupdate'],
    };
  }

  return {
    name: 'localtunnel',
    command: 'npx',
    args: ['--yes', 'localtunnel', '--port', String(DASHBOARD_PORT)],
  };
}

export async function shareDashboard() {
  const { url: localUrl, ready, alreadyRunning, child: dashboardChild } = await ensureDashboardServer({ attached: false });
  if (!ready) {
    throw new Error('לא הצלחתי להרים את שרת הדשבורד המקומי.');
  }

  const tunnel = await getTunnelCommand();

  console.log('\n  [CCSO] משתף את הדשבורד החי שלך...');
  console.log(`  Local dashboard: ${localUrl}`);
  console.log(`  Tunnel provider: ${tunnel.name}`);
  console.log('  אזהרה: כל מי שמחזיק בלינק יוכל לראות את הדשבורד המקומי שלך כל עוד ה-tunnel פתוח.\n');

  const tunnelProc = spawn(tunnel.command, tunnel.args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let resolved = false;
  let publicUrl = null;

  const cleanup = () => {
    if (tunnelProc && !tunnelProc.killed) tunnelProc.kill('SIGTERM');
    if (!alreadyRunning && dashboardChild && !dashboardChild.killed) dashboardChild.kill('SIGTERM');
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });

  const handleChunk = (chunk) => {
    const text = chunk.toString();
    const found = extractTunnelUrl(text);
    if (found && !publicUrl) {
      publicUrl = found;
      console.log(`  ✅ Public URL: ${publicUrl}`);
      console.log('  השאר חלון זה פתוח כדי שהשיתוף יישאר פעיל. לעצירה: Ctrl+C\n');
    }
  };

  tunnelProc.stdout.on('data', handleChunk);
  tunnelProc.stderr.on('data', handleChunk);

  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (publicUrl) return;
      cleanup();
      reject(new Error('ה-tunnel לא החזיר לינק בזמן. ייתכן שנדרש חיבור רשת או התקנת ספק tunnel.'));
    }, 90_000);

    const maybeResolve = () => {
      if (publicUrl && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          localUrl,
          publicUrl,
          provider: tunnel.name,
          process: tunnelProc,
          dashboardStartedByCommand: !alreadyRunning,
        });
      }
    };

    tunnelProc.stdout.on('data', maybeResolve);
    tunnelProc.stderr.on('data', maybeResolve);

    tunnelProc.on('error', (error) => {
      clearTimeout(timeout);
      cleanup();
      reject(error);
    });

    tunnelProc.on('close', (code) => {
      if (!resolved) {
        clearTimeout(timeout);
        cleanup();
        reject(new Error(`תהליך ה-tunnel נסגר מוקדם (code ${code ?? 'unknown'})`));
      }
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  shareDashboard().catch((error) => {
    console.error(`\n  ❌ ${error.message}\n`);
    process.exit(1);
  });
}
