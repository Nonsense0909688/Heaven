// Template + environment + variables  ->  fully-resolved, ready-to-send request.
// Pipeline: variables → base URL → env default headers → query → auth → body.
import { HeavenError } from '../core/errors.js';
import { Resolver } from '../core/variables.js';
import { DEFAULT_TIMEOUT_MS } from './constants.js';
import { setHeader } from './headers.js';
import { joinBase, addQuery } from './url.js';
import { prepareBody } from './body.js';

/** Add the Authorization header for --bearer / --basic. */
function applyAuth(auth, resolver, headers) {
  if (auth?.type === 'bearer') setHeader(headers, 'Authorization', `Bearer ${resolver.str(auth.token)}`);
  if (auth?.type === 'basic') {
    setHeader(headers, 'Authorization', `Basic ${Buffer.from(resolver.str(auth.value)).toString('base64')}`);
  }
}

export function prepare(template, { env = {}, vars = {} } = {}) {
  if (!template.url) throw new HeavenError('Missing URL');
  const r = new Resolver(vars);

  // 1) URL: resolve variables, then make it absolute using the base URL.
  const base = vars.baseUrl !== undefined ? r.str(String(vars.baseUrl)) : undefined;
  let url = joinBase(r.str(template.url), base);

  // 2) Headers: environment defaults first, then the request's own (which win).
  const headers = {};
  for (const [k, v] of Object.entries(env.headers || {})) setHeader(headers, k, r.str(v));
  for (const [k, v] of Object.entries(template.headers || {})) setHeader(headers, k, r.str(v));

  // 3) Query string, auth, body.
  if (template.query?.length) url = addQuery(url, template.query, (s) => r.str(s));
  applyAuth(template.auth, r, headers);
  const body = prepareBody(template.body, r, headers);

  // 4) Every placeholder must be resolved by now.
  r.assertComplete();

  return {
    method: template.method || 'GET',
    url,
    headers,
    body,
    timeout: template.timeout ?? DEFAULT_TIMEOUT_MS,
    follow: template.follow !== false,
  };
}
