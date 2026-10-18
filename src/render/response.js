// Formatting for a single HTTP response.
import { statusColor } from './colors.js';
import { formatBytes, formatMs } from './format.js';

/** "200 OK · 123 ms · 4.2 KB" */
export function statusLine(res, c) {
  const color = statusColor(c, res.status);
  return [
    color(c.bold(`${res.status} ${res.statusText}`.trim())),
    c.dim(formatMs(res.timeMs)),
    c.dim(formatBytes(res.size)),
  ].join(c.dim(' · '));
}

/** { a: 1, 'set-cookie': [x, y] } -> ["a: 1", "set-cookie: x", "set-cookie: y"] */
export function headerLines(headers) {
  const lines = [];
  for (const [k, v] of Object.entries(headers)) {
    for (const val of [].concat(v)) lines.push(`${k}: ${val}`);
  }
  return lines;
}

/** Machine-readable envelope for `--output json`. */
export function responseEnvelope(res, checks) {
  const env = {
    url: res.url,
    status: res.status,
    statusText: res.statusText,
    ok: res.ok,
    timeMs: Math.round(res.timeMs * 100) / 100,
    ttfbMs: Math.round(res.ttfbMs * 100) / 100,
    size: res.size,
    headers: res.headers,
  };
  if (res.saved) env.savedTo = res.saved;
  else if (res.binary) { env.body = null; env.bodyOmitted = 'binary'; }
  else if (res.json !== undefined) env.body = res.json;
  else if (res.text !== undefined) env.body = res.text;

  if (res.truncated) env.truncated = true;
  if (checks) env.checks = checks.checks.map(({ ok, label, detail }) => ({ ok, label, ...(detail ? { detail } : {}) }));
  return env;
}
