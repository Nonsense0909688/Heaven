// A request *template* is the saved/editable form of a request:
//   { method, url, headers, query[], body, auth, timeout, follow, expect }
// It keeps {{placeholders}} unresolved so it can be saved, replayed, and sent to any environment.
// Only keys that were actually given are present, so templates merge cleanly.
import { HeavenError } from '../core/errors.js';
import { parseHeader } from '../cli/value-parsers.js';
import { expectFromFlags } from '../assertions/parse.js';
import { SUPPORTED_METHODS } from './constants.js';

export function normalizeMethod(m) {
  const upper = String(m).toUpperCase();
  if (!SUPPORTED_METHODS.has(upper)) throw new HeavenError(`Unsupported method "${m}"`);
  return upper;
}

function headersFromFlags(list) {
  const headers = {};
  for (const h of list) {
    const [k, v] = parseHeader(h);
    headers[k] = v;
  }
  return headers;
}

/** Only one body option is allowed at a time. */
function bodyFromFlags(flags) {
  const chosen = ['json', 'data', 'upload'].filter((k) => flags[k] !== undefined);
  if (flags.form?.length) chosen.push('form');
  if (chosen.length > 1)
    throw new HeavenError(`Choose one body option, got: ${chosen.map((b) => '--' + b).join(', ')}`);

  if (flags.json !== undefined) return { type: 'json', value: flags.json };
  if (flags.data !== undefined) return { type: 'raw', value: flags.data };
  if (flags.upload !== undefined) return { type: 'file', value: flags.upload };
  if (flags.form?.length) return { type: 'form', value: [...flags.form] };
  return undefined;
}

function authFromFlags(flags) {
  if (flags.basic !== undefined) return { type: 'basic', value: flags.basic };
  if (flags.bearer !== undefined) return { type: 'bearer', token: flags.bearer };
  return undefined;
}

function timeoutFromFlags(flags) {
  const n = Number(flags.timeout);
  if (!Number.isFinite(n) || n <= 0)
    throw new HeavenError('--timeout must be a positive number of milliseconds');
  return n;
}

/** Build a template from CLI flags (method and url are optional so `run NAME -H ...` can reuse this). */
export function templateFromFlags(flags, method, url) {
  const t = {};
  if (method) t.method = normalizeMethod(method);
  if (url) t.url = url;
  if (flags.header?.length) t.headers = headersFromFlags(flags.header);
  if (flags.query?.length) t.query = [...flags.query];

  const body = bodyFromFlags(flags);
  if (body) t.body = body;
  const auth = authFromFlags(flags);
  if (auth) t.auth = auth;

  if (flags.timeout !== undefined) t.timeout = timeoutFromFlags(flags);
  if (flags['no-follow']) t.follow = false;
  const expect = expectFromFlags(flags);
  if (expect) t.expect = expect;
  return t;
}

/** Headers are case-insensitive: an override replaces an existing header of any casing. */
function mergeHeaders(base = {}, over) {
  const merged = { ...base };
  for (const [k, v] of Object.entries(over)) {
    for (const existing of Object.keys(merged)) {
      if (existing.toLowerCase() === k.toLowerCase()) delete merged[existing];
    }
    merged[k] = v;
  }
  return merged;
}

/** Query params with the same key are replaced, others are kept. */
function mergeQuery(base = [], over) {
  const overriddenKeys = new Set(over.map((q) => q.split('=')[0]));
  return [...base.filter((q) => !overriddenKeys.has(q.split('=')[0])), ...over];
}

/** Overlay `over` on `base` (used by `run NAME -H ...`, `replay ID --var ...`). */
export function mergeTemplate(base, over = {}) {
  const out = { ...base };
  for (const k of ['method', 'url', 'body', 'auth', 'timeout', 'follow', 'expect']) {
    if (over[k] !== undefined) out[k] = over[k];
  }
  if (over.headers) out.headers = mergeHeaders(base.headers, over.headers);
  if (over.query) out.query = mergeQuery(base.query, over.query);
  return out;
}
