// Field-by-field JSON diff with ignore patterns.
import { parsePath, joinPath } from '../../core/jsonpath.js';

const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/** "items[*].id" -> regex where * matches anything. */
function globToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+?^${}()|\\]/g, '\\$&')
    .replace(/\[/g, '\\[').replace(/\]/g, '\\]')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/**
 * Ignore patterns:
 *   "updatedAt"     any key named updatedAt, at any depth
 *   "user.id"       exact path
 *   "items[*].id"   wildcard path     "meta.*"
 */
export function isIgnored(path, patterns) {
  if (!patterns.length || !path) return false;
  const lastKey = String(parsePath(path).at(-1));
  return patterns.some((p) => p === path || lastKey === p || (p.includes('*') && globToRegex(p).test(path)));
}

/** @returns [{ path, type: 'added'|'removed'|'changed'|'type', a?, b? }] */
export function diffJson(a, b, ignore = []) {
  const diffs = [];
  walk(a, b, '', diffs, ignore);
  return diffs;
}

function walk(a, b, path, diffs, ignore) {
  if (isIgnored(path, ignore)) return;

  if (kind(a) !== kind(b)) { diffs.push({ path: path || '(root)', type: 'type', a, b }); return; }

  if (kind(a) === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    walkChildren(keys, (k) => joinPath(path, k), (k) => k in a, (k) => k in b, (k) => [a[k], b[k]], diffs, ignore);
  } else if (kind(a) === 'array') {
    const indexes = Array.from({ length: Math.max(a.length, b.length) }, (_, i) => i);
    walkChildren(indexes, (i) => joinPath(path, i), (i) => i < a.length, (i) => i < b.length, (i) => [a[i], b[i]], diffs, ignore);
  } else if (!Object.is(a, b)) {
    diffs.push({ path: path || '(root)', type: 'changed', a, b });
  }
}

// Shared logic for objects (keys) and arrays (indexes): report added/removed, recurse into the rest.
function walkChildren(keys, makePath, inA, inB, pair, diffs, ignore) {
  for (const key of keys) {
    const p = makePath(key);
    if (isIgnored(p, ignore)) continue;
    const [va, vb] = pair(key);
    if (!inA(key)) diffs.push({ path: p, type: 'added', b: vb });
    else if (!inB(key)) diffs.push({ path: p, type: 'removed', a: va });
    else walk(va, vb, p, diffs, ignore);
  }
}
