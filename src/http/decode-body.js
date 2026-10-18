// Decide whether a buffered body is binary, text, or JSON.
const BINARY_TYPE = /^(image|audio|video|font)\/|application\/(octet-stream|pdf|zip|gzip|x-tar|wasm)/i;

export function decodeBody(buffer, contentType, truncated) {
  const out = { text: undefined, json: undefined, binary: false };

  if (!buffer || buffer.length === 0) { out.text = ''; return out; }

  // Binary if the content type says so, or the first KB contains a NUL byte.
  if (BINARY_TYPE.test(contentType) || buffer.subarray(0, 1024).includes(0)) {
    out.binary = true;
    return out;
  }

  out.text = buffer.toString('utf8');
  // Only try JSON on complete bodies that look like JSON.
  const looksJson = /json/i.test(contentType) || /^\s*[[{]/.test(out.text);
  if (!truncated && looksJson) {
    try { out.json = JSON.parse(out.text); } catch { /* not JSON, keep as text */ }
  }
  return out;
}
