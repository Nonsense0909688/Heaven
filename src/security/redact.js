// Produce a safe-to-persist copy of a request template (used for history).
//
// A *literal secret* is a sensitive-looking value that is NOT a {{placeholder}}.
// Placeholders are safe to store because the real value lives elsewhere.
import { hasPlaceholder } from '../core/variables.js';
import { SENSITIVE_HEADERS, SENSITIVE_KEY, REDACTED } from './patterns.js';

export function redactHeaders(headers = {}) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(k.toLowerCase()) && !hasPlaceholder(v)) {
      const scheme = /^(Bearer|Basic|Token)\s+/i.exec(v);          // keep "Bearer " so history stays readable
      out[k] = scheme ? `${scheme[1]} ${REDACTED}` : REDACTED;
    } else out[k] = v;
  }
  return out;
}

/** "token=abc" -> "token=[REDACTED]"  (file refs like key=@file are kept) */
export function redactKeyValue(item) {
  const i = item.indexOf('=');
  if (i <= 0) return item;
  const key = item.slice(0, i);
  const value = item.slice(i + 1);
  const isSecret = SENSITIVE_KEY.test(key) && !hasPlaceholder(value) && !value.startsWith('@');
  return isSecret ? `${key}=${REDACTED}` : item;
}

export function redactUrl(url) {
  return url.replace(/([?&])([^=&#]+)=([^&#]*)/g, (whole, sep, key, value) => {
    let decoded = value;
    try { decoded = decodeURIComponent(value); } catch { /* keep raw */ }
    return SENSITIVE_KEY.test(key) && !hasPlaceholder(decoded) ? `${sep}${key}=${REDACTED}` : whole;
  });
}

function redactJsonValue(node) {
  if (Array.isArray(node)) return node.map(redactJsonValue);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      const secret = SENSITIVE_KEY.test(k) && typeof v === 'string' && !hasPlaceholder(v);
      out[k] = secret ? REDACTED : redactJsonValue(v);
    }
    return out;
  }
  return node;
}

export function redactBodyText(text) {
  try { return JSON.stringify(redactJsonValue(JSON.parse(text))); } catch { return text; }
}

export function redactTemplate(template) {
  const t = JSON.parse(JSON.stringify(template)); // deep copy; never mutate the original
  t.url = redactUrl(t.url);
  if (t.headers) t.headers = redactHeaders(t.headers);
  if (t.query) t.query = t.query.map(redactKeyValue);

  if (t.auth) {
    const secret = t.auth.token ?? t.auth.value;
    if (!hasPlaceholder(secret)) {
      if ('token' in t.auth) t.auth.token = REDACTED;
      else t.auth.value = REDACTED;
    }
  }
  if (t.body) {
    if (t.body.type === 'json' && !t.body.value.startsWith('@')) t.body.value = redactBodyText(t.body.value);
    if (t.body.type === 'form') t.body.value = t.body.value.map(redactKeyValue);
  }
  return t;
}
