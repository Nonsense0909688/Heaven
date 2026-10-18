// URL handling: base-URL joining and query-string building.
import { HeavenError } from '../core/errors.js';

/** Make a URL absolute: use it as-is, join with the base URL, or guess http/https for bare hosts. */
export function joinBase(raw, base) {
  if (/^https?:\/\//i.test(raw)) return raw;
  if (base) return base.replace(/\/+$/, '') + '/' + raw.replace(/^\/+/, '');
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3}|\[::1\])(:\d+)?([/?#]|$)/i.test(raw)) return 'http://' + raw;
  if (/^[^/\s]+\.[^/\s]+/.test(raw)) return 'https://' + raw;
  throw new HeavenError(
    `"${raw}" is a relative URL but no base URL is set.\n` +
    `  Try: heaven env set dev --base-url http://localhost:3000 && heaven env use dev`,
  );
}

/** Append "key=value" items (already variable-resolved by `resolve`) to a URL's query string. */
export function addQuery(url, items, resolve) {
  let u;
  try { u = new URL(url); } catch { throw new HeavenError(`Invalid URL: ${url}`); }
  for (const item of items) {
    const i = item.indexOf('=');
    if (i <= 0) throw new HeavenError(`Invalid query "${item}". Expected key=value`);
    u.searchParams.append(resolve(item.slice(0, i)), resolve(item.slice(i + 1)));
  }
  return u.toString();
}
