// Saved requests:  save · list · run · rm
import { HeavenError, EXIT } from '../core/errors.js';
import { templateFromFlags, mergeTemplate } from '../request/template.js';
import { findLiteralSecrets, redactedPlaces, hasRedactions } from '../security/inspect.js';
import { printTable } from '../render/index.js';
import { execute } from './execute.js';
import { isMethod, isJsonOutput, printJson, NAME_RE } from './shared.js';

// ── save ─────────────────────────────────────────────────────────────

/** `save NAME --last`: re-save the most recent history entry (only if it held no redacted secrets). */
function templateFromLastRequest(ctx, name) {
  const { flags, store } = ctx;
  const history = store.history();
  const entry = history[history.length - 1];
  if (!entry) throw new HeavenError('History is empty — nothing to save.');

  const template = mergeTemplate(entry.request, templateFromFlags(flags));
  if (hasRedactions(template)) {
    throw new HeavenError(
      `The last request contained secrets that were redacted from history:\n` +
        redactedPlaces(template)
          .map((p) => `    • ${p}`)
          .join('\n') +
        `\n  Save it explicitly using {{variables}}, e.g.: heaven save ${name} ${entry.request.method.toLowerCase()} ${entry.request.url.split('?')[0]} -H "Authorization: Bearer {{token}}"`
    );
  }
  return template;
}

/** `save NAME [METHOD] URL`: method is optional and defaults to GET. */
function templateFromPositionals(ctx) {
  let [, , method, url] = ctx.pos;
  if (method && !isMethod(method)) {
    url = method;
    method = 'get';
  }
  if (!url) throw new HeavenError('Usage: heaven save NAME [METHOD] URL [options]');
  return templateFromFlags(ctx.flags, method || 'get', url);
}

function warnAboutSecrets(ctx, template) {
  const secrets = findLiteralSecrets(template);
  if (!secrets.length) return;
  const { err, c, store } = ctx;
  err.write(
    c.yellow(`warning: saving literal secrets (${secrets.join(', ')}) to ${store.files.requests}\n`)
  );
  err.write(
    c.yellow(
      '         prefer {{variables}} or {{$env.NAME}} so credentials stay out of files you may commit.\n'
    )
  );
}

export function cmdSave(ctx) {
  const { pos, flags, store, err, c } = ctx;
  const name = pos[1];
  if (!name)
    throw new HeavenError(
      'Usage: heaven save NAME [METHOD] URL [options]   |   heaven save NAME --last'
    );
  if (!NAME_RE.test(name))
    throw new HeavenError(`Invalid name "${name}". Use letters, digits, dot, dash, underscore.`);

  const template = flags.last ? templateFromLastRequest(ctx, name) : templateFromPositionals(ctx);

  if (flags['requires-env']) {
    template['required-env'] = flags['requires-env'];
  }

  warnAboutSecrets(ctx, template);

  const all = store.requests();
  const existed = name in all;
  all[name] = template;
  store.saveRequests(all);
  err.write(
    `${existed ? 'updated' : 'saved'} ${c.bold(name)}  ${c.dim(`${template.method} ${template.url}`)}\n`
  );
  return EXIT.OK;
}

// ls

export function cmdList(ctx) {
  const { pos, flags, store, out, c } = ctx;
  const term = (pos[1] || flags.search || '').toLowerCase();

  const rows = Object.entries(store.requests())
    .filter(
      ([name, t]) =>
        !term || name.toLowerCase().includes(term) || t.url.toLowerCase().includes(term)
    )
    .sort(([a], [b]) => a.localeCompare(b));

  if (isJsonOutput(ctx)) {
    printJson(
      ctx,
      rows.map(([name, t]) => ({ name, ...t, 'required-env': t['required-env'] ?? null }))
    );
    return EXIT.OK;
  }

  if (!rows.length) {
    out.write(
      term
        ? 'No saved requests match.\n'
        : 'No saved requests yet. Try: heaven save health get /health\n'
    );
    return EXIT.OK;
  }
  printTable(
    rows.map(([name, t]) => [
      c.bold(name),
      t.method,
      t.url,
      t['required-env'] ? c.yellow(t['required-env']) : c.dim('-'),
      t.expect ? c.dim('(has expectations)') : '',
    ]),
    ['NAME', 'METHOD', 'URL', 'REQUIRES ENV', ''],
    (s) => out.write(s),
    c
  );
  return EXIT.OK;
}

// run

export async function cmdRun(ctx) {
  const { pos, flags, store } = ctx;
  const name = pos[1];

  if (!name) throw new HeavenError('Usage: heaven run NAME [overrides]');

  const saved = store.getRequest(name);
  const template = mergeTemplate(saved, templateFromFlags(flags));

  const requiredEnv = template['required-env'];
  const targetEnv = flags.env?.at(-1) ?? template.env ?? store.config().active ?? null;

  if (requiredEnv && targetEnv !== requiredEnv) {
    throw new HeavenError(
      `Environment mismatch: "${name}" requires "${requiredEnv}", ` +
        `but the target environment is "${targetEnv ?? '(none)'}".`
    );
  }

  return execute(ctx, template, {
    historyName: name,
    envName: targetEnv,
  });
}

// rm

export function cmdRm(ctx) {
  const name = ctx.pos[1];
  if (!name) throw new HeavenError('Usage: heaven rm NAME');
  const all = ctx.store.requests();
  if (!(name in all)) throw new HeavenError(`No saved request named "${name}"`);
  delete all[name];
  ctx.store.saveRequests(all);
  ctx.err.write(`removed ${name}\n`);
  return EXIT.OK;
}
