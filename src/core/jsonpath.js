// A tiny path language used by --expect-json, flow `extract`, and compare --ignore.
//   a.b[0].c     ["odd key"]     leading "$." or "$" is optional

/** "a.b[0]" -> ["a", "b", 0]  (numbers are array indexes, strings are keys) */
export function parsePath(p) {
  const s = String(p).trim().replace(/^\$\.?/, '');
  const segments = [];
  const token = /\[(\d+)\]|\["([^"]*)"\]|([^.[\]]+)/g;
  let m;
  while ((m = token.exec(s))) {
    if (m[1] !== undefined) segments.push(Number(m[1]));      // [0]
    else if (m[2] !== undefined) segments.push(m[2]);         // ["odd key"]
    else segments.push(m[3]);                                 // plain key
  }
  return segments;
}

/** Walk `obj` along path `p`. Returns { found: false } or { found: true, value }. */
export function getPath(obj, p) {
  let cur = obj;
  for (const key of parsePath(p)) {
    if (cur === null || typeof cur !== 'object' || !(key in cur)) return { found: false };
    cur = cur[key];
  }
  return { found: true, value: cur };
}

/** Append a key or index to a path string (used when reporting diffs). */
export function joinPath(base, key) {
  if (typeof key === 'number') return `${base}[${key}]`;
  return base ? `${base}.${key}` : key;
}
