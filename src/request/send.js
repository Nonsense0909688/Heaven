// The one code path every command uses to send something:
//   template → (env + vars) → resolved request → HTTP → history.
import { prepare } from './prepare.js';
import { executeRequest } from '../http/engine.js';
import { redactTemplate } from '../security/redact.js';

/** Pick the environment: explicit name > active one > none. */
export function resolveEnv(store, envName) {
  const name = envName ?? store.config().active ?? null;
  return { name, env: name ? store.getEnv(name) : {} };
}

/** Variable precedence (low → high): env baseUrl < env vars < flow/extracted vars < --var flags. */
export function buildVars(env, extra = {}, cli = {}) {
  const vars = {};
  if (env.baseUrl) vars.baseUrl = env.baseUrl;
  return Object.assign(vars, env.vars, extra, cli);
}

/**
 * @param opts { envName, extraVars, cliVars, engine, historyName, record, onPrepared }
 * @returns { res, resolved, envName, historyId }
 */
export async function sendTemplate(store, template, opts = {}) {
  const { envName, extraVars, cliVars, engine, historyName, record = true, onPrepared } = opts;

  const { name: env, env: envDef } = resolveEnv(store, envName);
  const resolved = prepare(template, { env: envDef, vars: buildVars(envDef, extraVars, cliVars) });
  if (onPrepared) onPrepared(resolved);

  // History stores the *redacted template* (never resolved secrets, never bodies of responses).
  const entry = { name: historyName, env, request: redactTemplate(template) };

  let res;
  try {
    res = await executeRequest(resolved, engine);
  } catch (e) {
    if (record) store.appendHistory({ ...entry, error: e.message });
    throw e;
  }

  const historyId = record
    ? store.appendHistory({
      ...entry,
      status: res.status,
      timeMs: Math.round(res.timeMs),
      size: res.size,
      contentType: res.contentType || undefined,
    })
    : undefined;
  return { res, resolved, envName: env, historyId };
}
