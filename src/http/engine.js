// Sends one fully-resolved request and returns a normalized response object.
import { performance } from 'node:perf_hooks';
import { toNetworkError } from './network-errors.js';
import { buildFetchBody } from './request-body.js';
import { readBody } from './read-body.js';
import { decodeBody } from './decode-body.js';

export const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024; // 10 MB kept in memory for display

/** Flatten fetch Headers into a plain object (set-cookie stays an array). */
function collectHeaders(res) {
  const headers = {};
  res.headers.forEach((v, k) => { headers[k] = v; });
  const cookies = res.headers.getSetCookie?.() ?? [];
  if (cookies.length) headers['set-cookie'] = cookies;
  return headers;
}

/**
 * @param req   resolved request from request/prepare.js
 * @param opts  { outputFile, onChunk, discard, maxBuffer } – see read-body.js
 */
export async function executeRequest(req, opts = {}) {
  const { outputFile, onChunk, discard = false, maxBuffer = DEFAULT_MAX_BUFFER } = opts;

  const init = {
    method: req.method,
    headers: req.headers,
    redirect: req.follow === false ? 'manual' : 'follow',
    signal: AbortSignal.timeout(req.timeout),
    ...(await buildFetchBody(req.body)),
  };

  // 1) Send, and measure time-to-first-byte (headers received).
  const t0 = performance.now();
  let res;
  try {
    res = await fetch(req.url, init);
  } catch (e) {
    throw toNetworkError(e, req);
  }
  const ttfbMs = performance.now() - t0;

  // 2) Read the body using the requested strategy.
  const headers = collectHeaders(res);
  const contentType = headers['content-type'] || '';
  let body;
  try {
    body = await readBody(res, { outputFile, onChunk, discard, maxBuffer });
  } catch (e) {
    throw toNetworkError(e, req);
  }
  const timeMs = performance.now() - t0;

  // 3) Interpret the body (text / JSON / binary) and assemble the result.
  const decoded = decodeBody(body.buffer, contentType, body.truncated);
  return {
    url: res.url || req.url,
    status: res.status,
    statusText: res.statusText,
    ok: res.status < 400,
    redirected: res.redirected,
    headers,
    contentType,
    timeMs,
    ttfbMs,
    size: body.size,
    truncated: body.truncated,
    saved: body.saved,
    buffer: body.buffer,
    text: decoded.text,
    json: decoded.json,
    binary: decoded.binary,
    contentLength: headers['content-length'] ? Number(headers['content-length']) : undefined,
  };
}
