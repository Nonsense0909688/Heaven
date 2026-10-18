// Turn our internal body description into something `fetch` accepts.
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { HeavenError } from '../core/errors.js';

/** Multipart form: plain fields plus file uploads (name=@path). */
async function buildForm(fields) {
  const form = new FormData();
  for (const f of fields) {
    if (!f.file) { form.append(f.name, f.value); continue; }
    if (!fs.existsSync(f.file)) throw new HeavenError(`Form file not found: ${f.file}`);
    const blob = typeof fs.openAsBlob === 'function' ? await fs.openAsBlob(f.file) : new Blob([fs.readFileSync(f.file)]);
    form.append(f.name, blob, f.file.split(/[\\/]/).pop());
  }
  return form;
}

/** Returns the body-related part of fetch's init object. */
export async function buildFetchBody(body) {
  if (!body) return {};
  switch (body.type) {
    case 'text': return { body: body.value };
    // Streamed from disk so huge uploads never sit in memory.
    case 'file': return { body: Readable.toWeb(fs.createReadStream(body.path)), duplex: 'half' };
    case 'form': return { body: await buildForm(body.fields) };
    default: return {};
  }
}
