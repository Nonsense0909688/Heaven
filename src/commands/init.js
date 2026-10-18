// heaven init — create a project-local .heaven/ folder (meant to be committed, minus history).
import fs from 'node:fs';
import path from 'node:path';
import { EXIT } from '../core/errors.js';
import { Store } from '../storage/store.js';

export function cmdInit(ctx) {
  const dir = path.join(process.cwd(), '.heaven');
  const store = new Store(dir);
  const existed = fs.existsSync(dir);

  store.ensureDir();
  if (!fs.existsSync(store.files.config)) store.saveConfig({ active: null, envs: {} });
  if (!fs.existsSync(store.files.requests)) store.saveRequests({});
  fs.writeFileSync(path.join(dir, '.gitignore'), 'history.jsonl\n');   // history stays local

  ctx.err.write(`${existed ? 'already initialised' : 'created'} ${dir}\n`);
  ctx.err.write(ctx.c.dim('requests.json and config.json are meant to be committed — keep secrets in {{$env.NAME}} references.\n'));
  return EXIT.OK;
}
