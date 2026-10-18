// Turn a template body into the resolved body the HTTP engine sends,
// and set sensible default Content-Type headers.
import fs from 'node:fs';
import { HeavenError } from '../core/errors.js';
import { setDefaultHeader } from './headers.js';

/** "@file.json" -> contents of that file; anything else is returned unchanged. */
function readMaybeFile(value) {
  if (!value.startsWith('@')) return value;
  const file = value.slice(1);
  try { return fs.readFileSync(file, 'utf8'); } catch (e) {
    throw new HeavenError(`Cannot read ${file}: ${e.code === 'ENOENT' ? 'file not found' : e.message}`);
  }
}

function jsonBody(b, r, headers) {
  const text = r.str(readMaybeFile(b.value));
  r.assertComplete(); // report missing variables *before* complaining about invalid JSON
  try { JSON.parse(text); } catch (e) {
    throw new HeavenError(
      `--json body is not valid JSON: ${e.message}\n` +
      `  Tip (PowerShell): put the JSON in a file and use --json @body.json`,
    );
  }
  setDefaultHeader(headers, 'Content-Type', 'application/json');
  setDefaultHeader(headers, 'Accept', 'application/json');
  return { type: 'text', value: text };
}

function rawBody(b, r, headers) {
  const text = r.str(readMaybeFile(b.value));
  const looksLikeForm = /^[\w.%+-]+=[^]*$/.test(text);           // "a=1&b=2"
  setDefaultHeader(headers, 'Content-Type', looksLikeForm ? 'application/x-www-form-urlencoded' : 'text/plain');
  return { type: 'text', value: text };
}

function formBody(b, r) {
  const fields = b.value.map((item) => {
    const i = item.indexOf('=');
    if (i <= 0) throw new HeavenError(`Invalid form field "${item}". Expected name=value or name=@file`);
    const name = r.str(item.slice(0, i));
    const val = r.str(item.slice(i + 1));
    return val.startsWith('@') ? { name, file: val.slice(1) } : { name, value: val };   // name=@path uploads a file
  });
  return { type: 'form', fields };
}

function fileBody(b, r, headers) {
  const file = r.str(b.value);
  if (!fs.existsSync(file)) throw new HeavenError(`Upload file not found: ${file}`);
  setDefaultHeader(headers, 'Content-Type', 'application/octet-stream');
  return { type: 'file', path: file };
}

const BUILDERS = { json: jsonBody, raw: rawBody, form: formBody, file: fileBody };

/** Returns the resolved body (or undefined). May add default headers. */
export function prepareBody(body, resolver, headers) {
  if (!body) return undefined;
  const build = BUILDERS[body.type];
  return build ? build(body, resolver, headers) : undefined;
}
