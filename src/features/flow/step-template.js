// Convert one workflow step (as written in the JSON file) into a request template.
import { HeavenError } from '../../core/errors.js';
import { mergeTemplate, normalizeMethod } from '../../request/template.js';

const toQueryList = (q) => (Array.isArray(q) ? q : Object.entries(q).map(([k, v]) => `${k}=${v}`));

/** The step's own fields, expressed as a template override. */
function overridesFromStep(step) {
  const over = {};
  if (step.method) over.method = normalizeMethod(step.method);
  if (step.url) over.url = step.url;
  if (step.headers) over.headers = step.headers;
  if (step.query) over.query = toQueryList(step.query);

  if (step.json !== undefined) {
    over.body = { type: 'json', value: typeof step.json === 'string' ? step.json : JSON.stringify(step.json) };
  } else if (step.data !== undefined) {
    over.body = { type: 'raw', value: String(step.data) };
  } else if (step.form) {
    over.body = { type: 'form', value: toQueryList(step.form) };
  }

  if (step.bearer !== undefined) over.auth = { type: 'bearer', token: String(step.bearer) };
  if (step.basic !== undefined) over.auth = { type: 'basic', value: String(step.basic) };
  if (step.timeout !== undefined) over.timeout = step.timeout;
  if (step.expect) over.expect = step.expect;
  return over;
}

/** A step is either inline (method/url/...) or "use": "saved-request-name" plus overrides. */
export function stepTemplate(step, store, index) {
  const base = step.use ? store.getRequest(step.use) : {};
  const t = mergeTemplate(base, overridesFromStep(step));
  if (!t.url) throw new HeavenError(`Step ${index + 1} (${step.name || 'unnamed'}) needs "use" (a saved request) or "url"`);
  if (!t.method) t.method = 'GET';
  return t;
}
