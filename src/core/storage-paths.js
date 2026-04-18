import * as os from 'os';
import * as path from 'path';

export function getCCSODataDir() {
  return process.env.CCSO_HOME || path.join(os.homedir(), '.config', 'claude-smart-optimizer');
}

export function getCCSOPath(...parts) {
  return path.join(getCCSODataDir(), ...parts);
}
