// Read/write one JSON file safely.
import fs from 'node:fs';
import { HeavenError } from '../core/errors.js';

/** Parsed JSON, or `fallback` if the file doesn't exist yet. */
export function readJson(file, fallback) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
  try { return JSON.parse(text); } catch (e) {
    throw new HeavenError(`${file} is not valid JSON (${e.message}). Fix or delete it.`);
  }
}

/** Write to a temp file then rename, so a crash can never leave a half-written file. */
export function writeJson(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, file);
}
