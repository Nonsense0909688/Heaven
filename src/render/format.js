// Number/time formatting helpers.

export function formatBytes(n) {
  if (n === undefined || n === null) return '?';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export const formatMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);

/** ISO timestamp -> "2025-01-31 14:05:09" in local time. */
export function localTime(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Shorten a value for one-line display in diffs. */
export function shortValue(v) {
  const s = JSON.stringify(v) ?? String(v);
  return s.length > 70 ? s.slice(0, 67) + '…' : s;
}
