// Case-insensitive header helpers (HTTP header names are case-insensitive).

const hasHeader = (headers, name) => Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase());

/** Set a header, replacing any existing one regardless of casing. */
export function setHeader(headers, name, value) {
  for (const existing of Object.keys(headers)) {
    if (existing.toLowerCase() === name.toLowerCase()) delete headers[existing];
  }
  headers[name] = value;
}

/** Set a header only if the user hasn't already provided one. */
export function setDefaultHeader(headers, name, value) {
  if (!hasHeader(headers, name)) headers[name] = value;
}
