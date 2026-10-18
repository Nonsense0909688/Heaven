// Pull a value out of a response for use in later steps.
//   status · headers.location · body.a.b[0] · body
import { getPath } from '../../core/jsonpath.js';

export function extractValue(res, spec) {
  if (spec === 'status') return res.status;

  if (spec.startsWith('headers.')) {
    const v = res.headers[spec.slice('headers.'.length).toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  }

  if (res.json === undefined) return undefined;
  const path = spec === 'body' ? '' : spec.replace(/^body\.?/, '');
  const { found, value } = getPath(res.json, path);
  return found ? value : undefined;
}
