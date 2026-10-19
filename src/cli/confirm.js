import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { HeavenError } from '../core/errors.js';

export async function confirmProtectedRequest(envName, method) {
  if (!envName || method.toUpperCase() === 'GET') return true;

  if (!stdin.isTTY || !stdout.isTTY) {
    throw new HeavenError(
      `Environment "${envName}" requires confirmation for ${method}. ` +
        'Run interactively or use an explicit authorization flag.'
    );
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const answer = await rl.question(
      `\n⚠ ${method.toUpperCase()} request to protected environment "${envName}". Continue? [y/N] `
    );

    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}
