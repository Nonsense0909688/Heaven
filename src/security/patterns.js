// What counts as "sensitive". Shared by redaction and the save/env warnings.

export const SENSITIVE_HEADERS = new Set([
  'authorization', 'proxy-authorization', 'cookie', 'set-cookie',
  'x-api-key', 'api-key', 'x-auth-token', 'x-access-token', 'x-csrf-token',
]);

// Key names (query params, JSON fields, env vars) that look like secrets.
export const SENSITIVE_KEY = /pass(word|wd)?|secret|token|api[_-]?key|auth|signature|credential/i;

export const REDACTED = '[REDACTED]';
