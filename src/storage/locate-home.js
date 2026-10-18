// Decide which directory holds Heaven's data.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Where Heaven keeps its data, in priority order:
 *   1. $HEAVEN_HOME
 *   2. nearest ./.heaven directory walking up from cwd (project-local, git-friendly)
 *   3. ~/.heaven
 */
export function locateHome(cwd = process.cwd(), env = process.env) {
  if (env.HEAVEN_HOME) return path.resolve(env.HEAVEN_HOME);

  let dir = path.resolve(cwd);
  for (;;) {
    const candidate = path.join(dir, '.heaven');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return path.join(os.homedir(), '.heaven');
}
