import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

export const DASHBOARD_PORT = 3847;
export const DASHBOARD_URL = `http://localhost:${DASHBOARD_PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function isDashboardReachable(timeoutMs = 900) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${DASHBOARD_URL}/api/stats`, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function waitForDashboardReady(totalWaitMs = 5000, intervalMs = 250) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= totalWaitMs) {
    if (await isDashboardReachable()) return true;
    await sleep(intervalMs);
  }

  return false;
}

export function openDashboardBrowser(url = DASHBOARD_URL) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    return;
  }

  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(opener, [url], { detached: true, stdio: 'ignore' }).unref();
}

export function getDashboardServerPath() {
  return fileURLToPath(new URL('./server.js', import.meta.url));
}

export async function ensureDashboardServer({ attached = false } = {}) {
  if (await isDashboardReachable()) {
    return {
      url: DASHBOARD_URL,
      alreadyRunning: true,
      ready: true,
      child: null,
    };
  }

  const child = spawn(
    process.execPath,
    [getDashboardServerPath()],
    attached ? { stdio: 'inherit' } : { detached: true, stdio: 'ignore' },
  );

  if (!attached) child.unref();

  const ready = await waitForDashboardReady();

  return {
    url: DASHBOARD_URL,
    alreadyRunning: false,
    ready,
    child,
  };
}
