// heaven history [show ID | clear]   ·   heaven replay ID
import { HeavenError, EXIT } from '../core/errors.js';
import { last } from '../cli/value-parsers.js';
import { templateFromFlags, mergeTemplate } from '../request/template.js';
import { redactedPlaces, hasRedactions } from '../security/inspect.js';
import { printTable, statusColor, formatBytes, formatMs, localTime } from '../render/index.js';
import { execute } from './execute.js';
import { isJsonOutput, printJson } from './shared.js';

function historyShow(ctx, id) {
  const { store, out, c } = ctx;
  if (!id) throw new HeavenError('Usage: heaven history show ID');
  const e = store.getHistory(id);

  if (isJsonOutput(ctx)) { printJson(ctx, e); return EXIT.OK; }

  const r = e.request;
  out.write(`${c.bold('#' + e.id)}  ${localTime(e.time)}${e.env ? `  env=${e.env}` : ''}${e.name ? `  name=${e.name}` : ''}\n`);
  out.write(`${r.method} ${r.url}\n`);
  for (const [k, v] of Object.entries(r.headers || {})) out.write(`  ${k}: ${v}\n`);
  for (const q of r.query || []) out.write(`  ?${q}\n`);
  if (r.auth) out.write(`  auth: ${r.auth.type} ${r.auth.token ?? r.auth.value}\n`);
  if (r.body) out.write(`  body (${r.body.type}): ${[].concat(r.body.value).join(' ')}\n`);
  out.write(e.error
    ? c.red(`error: ${e.error}\n`)
    : `→ ${e.status} · ${formatMs(e.timeMs)} · ${formatBytes(e.size)}${e.contentType ? ` · ${e.contentType}` : ''}\n`);
  return EXIT.OK;
}

function historyList(ctx) {
  const { flags, store, out, c } = ctx;
  const limit = flags.limit !== undefined ? Number(flags.limit) : 20;
  if (!(limit > 0)) throw new HeavenError('--limit must be a positive number');
  const term = (flags.search || '').toLowerCase();

  const rows = store.history()
    .filter((e) => !term || `${e.request.method} ${e.request.url} ${e.name || ''} ${e.env || ''}`.toLowerCase().includes(term))
    .slice(-limit);

  if (isJsonOutput(ctx)) { printJson(ctx, rows); return EXIT.OK; }
  if (!rows.length) { out.write('No history yet.\n'); return EXIT.OK; }

  printTable(
    rows.map((e) => [
      c.dim('#' + e.id), c.dim(localTime(e.time)), e.request.method, e.request.url,
      e.error ? c.red('ERR') : statusColor(c, e.status)(String(e.status)),
      e.error ? c.dim(e.error.slice(0, 40)) : c.dim(formatMs(e.timeMs)),
      c.dim([e.env, e.name].filter(Boolean).join('/')),
    ]), null, (s) => out.write(s), c,
  );
  return EXIT.OK;
}

export function cmdHistory(ctx) {
  const sub = ctx.pos[1];
  if (sub === 'clear') { ctx.store.clearHistory(); ctx.err.write('history cleared\n'); return EXIT.OK; }
  if (sub === 'show') return historyShow(ctx, ctx.pos[2]);
  if (sub && sub !== 'list') throw new HeavenError(`Unknown history command "${sub}". Use: show ID, clear`);
  return historyList(ctx);
}

/** Re-send a history entry. Secrets were redacted when stored, so they must be re-supplied. */
export async function cmdReplay(ctx) {
  const { pos, flags, store, err, c } = ctx;
  if (!pos[1]) throw new HeavenError('Usage: heaven replay ID [overrides]');

  const entry = store.getHistory(pos[1]);
  const template = mergeTemplate(entry.request, templateFromFlags(flags));

  if (hasRedactions(template)) {
    throw new HeavenError(
      `Request #${entry.id} contained secrets that were redacted when it was stored. Supply them again:\n` +
      redactedPlaces(template).map((p) => `    • ${p}`).join('\n') +
      `\n  Tip: use {{variables}} or {{$env.NAME}} in requests and they replay without any extra flags.`,
    );
  }

  // Prefer --env, then the environment the entry originally used (if it still exists).
  let envName = last(flags.env) ?? entry.env ?? undefined;
  if (envName && !store.config().envs[envName]) {
    err.write(c.yellow(`warning: environment "${envName}" no longer exists; using the active one\n`));
    envName = undefined;
  }
  return execute(ctx, template, { historyName: entry.name, envName });
}
