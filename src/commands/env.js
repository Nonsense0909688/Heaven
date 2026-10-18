// heaven env set|use|list|show|rm
import { HeavenError, EXIT } from '../core/errors.js';
import { hasPlaceholder } from '../core/variables.js';
import { parseHeader } from '../cli/value-parsers.js';
import { resolveEnv } from '../request/send.js';
import { redactHeaders } from '../security/redact.js';
import { SENSITIVE_KEY } from '../security/patterns.js';
import { printTable } from '../render/index.js';
import { NAME_RE, isJsonOutput, printJson, varsFromFlags } from './shared.js';

/** Hide values of secret-looking variables when displaying an environment. */
const maskVars = (vars = {}) => Object.fromEntries(
  Object.entries(vars).map(([k, v]) => [k, SENSITIVE_KEY.test(k) && !hasPlaceholder(String(v)) ? '********' : v]),
);

// Each subcommand is a small function of (ctx, name).

function envSet(ctx, name) {
  const { flags, store, err, c } = ctx;
  if (!name) throw new HeavenError('Usage: heaven env set NAME [--base-url URL] [-v k=v] [-H "K: v"]');
  if (!NAME_RE.test(name)) throw new HeavenError(`Invalid environment name "${name}"`);

  const cfg = store.config();
  const env = cfg.envs[name] ?? { vars: {}, headers: {} };   // `set` edits an existing env or creates one
  env.vars ??= {};
  env.headers ??= {};

  if (flags['base-url']) env.baseUrl = flags['base-url'].replace(/\/+$/, '');

  for (const [k, v] of Object.entries(varsFromFlags(flags))) {
    if (v === '') { delete env.vars[k]; continue; }             // `-v key=` removes the variable
    env.vars[k] = v;
    if (SENSITIVE_KEY.test(k) && !hasPlaceholder(v)) {
      err.write(c.yellow(`warning: "${k}" looks like a secret and is stored in plaintext in ${store.files.config}\n`));
      err.write(c.yellow(`         safer: -v ${k}='{{$env.${k.toUpperCase()}}}'  (reads it from your shell at request time)\n`));
    }
  }
  for (const h of flags.header || []) { const [k, v] = parseHeader(h); env.headers[k] = v; }

  cfg.envs[name] = env;
  if (!cfg.active) cfg.active = name;                           // first environment becomes active
  store.saveConfig(cfg);
  err.write(`environment ${c.bold(name)} saved${cfg.active === name ? c.dim(' (active)') : ''}\n`);
  return EXIT.OK;
}

function envUse(ctx, name) {
  if (!name) throw new HeavenError('Usage: heaven env use NAME');
  ctx.store.getEnv(name);                                       // throws if it doesn't exist
  const cfg = ctx.store.config();
  cfg.active = name;
  ctx.store.saveConfig(cfg);
  ctx.err.write(`now using ${ctx.c.bold(name)}\n`);
  return EXIT.OK;
}

function envList(ctx) {
  const { store, out, c } = ctx;
  const cfg = store.config();
  const names = Object.keys(cfg.envs).sort();

  if (isJsonOutput(ctx)) { printJson(ctx, { active: cfg.active, environments: names }); return EXIT.OK; }
  if (!names.length) { out.write('No environments yet. Try: heaven env set dev --base-url http://localhost:3000\n'); return EXIT.OK; }

  printTable(
    names.map((n) => [n === cfg.active ? c.green('*') : ' ', c.bold(n), cfg.envs[n].baseUrl || c.dim('(no base URL)')]),
    null, (s) => out.write(s), c,
  );
  return EXIT.OK;
}

function envShow(ctx, name) {
  const { store, out, c } = ctx;
  const { name: n, env } = resolveEnv(store, name);
  if (!n) throw new HeavenError('No active environment. Use: heaven env use NAME');

  const view = { name: n, baseUrl: env.baseUrl, vars: maskVars(env.vars), headers: redactHeaders(env.headers) };
  if (isJsonOutput(ctx)) { printJson(ctx, view); return EXIT.OK; }

  out.write(`${c.bold(n)}${store.config().active === n ? c.dim(' (active)') : ''}\n`);
  out.write(`  baseUrl  ${view.baseUrl ?? c.dim('(none)')}\n`);
  for (const [k, v] of Object.entries(view.vars)) out.write(`  var      ${k} = ${v}\n`);
  for (const [k, v] of Object.entries(view.headers)) out.write(`  header   ${k}: ${v}\n`);
  return EXIT.OK;
}

function envRemove(ctx, name) {
  if (!name) throw new HeavenError('Usage: heaven env rm NAME');
  ctx.store.getEnv(name);
  const cfg = ctx.store.config();
  delete cfg.envs[name];
  if (cfg.active === name) cfg.active = null;
  ctx.store.saveConfig(cfg);
  ctx.err.write(`removed environment ${name}\n`);
  return EXIT.OK;
}

const SUBCOMMANDS = { set: envSet, use: envUse, list: envList, ls: envList, show: envShow, rm: envRemove };

export function cmdEnv(ctx) {
  const sub = (ctx.pos[1] || 'list').toLowerCase();
  const handler = SUBCOMMANDS[sub];
  if (!handler) throw new HeavenError(`Unknown env command "${sub}". Use: set, use, list, show, rm`);
  return handler(ctx, ctx.pos[2]);
}
