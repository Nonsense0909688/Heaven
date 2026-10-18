import { isDeepStrictEqual } from 'node:util';

// Headers that differ on every request; reporting them would just be noise.
const VOLATILE_HEADERS = new Set([
  'date', 'age', 'set-cookie', 'x-request-id', 'request-id', 'x-correlation-id',
  'x-amzn-trace-id', 'cf-ray', 'server-timing', 'expires', 'last-modified',
]);

export function diffHeaders(a, b, ignore = []) {
  const diffs = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (VOLATILE_HEADERS.has(k) || ignore.includes(k)) continue;
    if (!(k in a)) diffs.push({ path: k, type: 'added', b: b[k] });
    else if (!(k in b)) diffs.push({ path: k, type: 'removed', a: a[k] });
    else if (!isDeepStrictEqual(a[k], b[k])) diffs.push({ path: k, type: 'changed', a: a[k], b: b[k] });
  }
  return diffs;
}
