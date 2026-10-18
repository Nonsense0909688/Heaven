import crypto from 'node:crypto';
import { diffJson } from './diff-json.js';
import { diffHeaders } from './diff-headers.js';

const fingerprint = (buf) => crypto.createHash('sha256').update(buf ?? '').digest('hex').slice(0, 12);

/** Compare bodies: JSON field-by-field, text by equality, binary by hash. */
function compareBodies(a, b, ignore) {
  const aJson = a.json !== undefined;
  const bJson = b.json !== undefined;

  if (aJson && bJson) return { kind: 'json', diffs: diffJson(a.json, b.json, ignore) };

  if (aJson || bJson) { // one side is JSON, the other isn't
    return { kind: 'mixed', diffs: [{ path: '(root)', type: 'type', a: a.json ?? '(non-JSON)', b: b.json ?? '(non-JSON)' }] };
  }
  if (a.text !== undefined && b.text !== undefined) {
    const same = a.text === b.text;
    return { kind: 'text', diffs: same ? [] : [{ path: '(body)', type: 'changed', a: `${a.text.length} chars`, b: `${b.text.length} chars` }] };
  }
  const same = fingerprint(a.buffer) === fingerprint(b.buffer) && a.size === b.size;
  return { kind: 'binary', diffs: same ? [] : [{ path: '(body)', type: 'changed', a: `${a.size} bytes`, b: `${b.size} bytes` }] };
}

/** Compare two completed responses. `ignore` applies to JSON paths and header names. */
export function compareResponses(a, b, { ignore = [], headers = false } = {}) {
  const result = {
    status: { a: a.status, b: b.status, same: a.status === b.status },
    time: { a: Math.round(a.timeMs), b: Math.round(b.timeMs) },   // informational only, never a "difference"
    size: { a: a.size, b: b.size },
    headers: headers ? diffHeaders(a.headers, b.headers, ignore.map((s) => s.toLowerCase())) : null,
    body: compareBodies(a, b, ignore),
  };
  result.identical = result.status.same && result.body.diffs.length === 0 && (!result.headers || result.headers.length === 0);
  return result;
}
