// Everything printed after a request: verbose headers, body, status line, check results.
import { redactHeaders } from '../security/redact.js';
import {
  formatBytes,
  formatMs,
  statusLine,
  headerLines,
  colorizeJson,
  responseEnvelope,
} from '../render/index.js';
import { isJsonOutput, printJson } from './shared.js';

/** `-V`: show the request we are about to send (secrets masked). */
export function printRequestVerbose(ctx, r) {
  const { err, c } = ctx;
  err.write(c.bold(`> ${r.method} ${r.url}`) + '\n');
  for (const line of headerLines(redactHeaders(r.headers))) err.write(c.dim(`> ${line}`) + '\n');
  err.write(c.dim('>') + '\n');
}

function printVerboseResponse(ctx, res) {
  const { err, c } = ctx;
  err.write(c.bold(`< ${res.status} ${res.statusText}`) + '\n');
  for (const line of headerLines(res.headers)) err.write(c.dim(`< ${line}`) + '\n');
  err.write(c.dim(`< (ttfb ${formatMs(res.ttfbMs)})`) + '\n');
}

/** The response body on stdout: pretty/colourised JSON in a terminal, raw otherwise. */
function printBody(ctx, res) {
  const { flags, out, err, c, cout } = ctx;
  if (res.saved || flags.stream) return; // already written elsewhere

  if (res.binary) {
    err.write(
      c.yellow(`binary body (${formatBytes(res.size)}) not shown — use -o FILE to save it`) + '\n'
    );
    return;
  }
  if (!res.text) return;

  const tty = Boolean(out.isTTY);
  const pretty = res.json !== undefined && !flags.raw && (tty || flags.pretty);
  let text = res.text;
  if (pretty) {
    text = JSON.stringify(res.json, null, 2);
    if (tty) text = colorizeJson(text, cout);
  }
  out.write(text);
  if ((tty || pretty) && !text.endsWith('\n')) out.write('\n');
}

/** Status line, "saved to", truncation and history notes (stderr). */
function printFooter(ctx, sent) {
  const { err, c } = ctx;
  const { res } = sent;
  err.write(statusLine(res, c) + (res.redirected ? c.dim(` · ${res.url}`) : '') + '\n');
  if (res.saved) err.write(c.dim(`saved ${formatBytes(res.size)} → ${res.saved}`) + '\n');
  if (res.truncated) {
    err.write(
      c.yellow(
        `output truncated at ${formatBytes(res.size)} (use -o FILE to stream the full body to disk, or --max-buffer MB)`
      ) + '\n'
    );
  }
  if (sent.historyId) err.write(c.dim(`history #${sent.historyId}`) + '\n');
}

function printChecks(ctx, checks) {
  const { flags, err, c } = ctx;
  for (const ch of checks.checks) {
    if (flags.silent && ch.ok) continue; // even with --silent, a failed expectation must say why
    const mark = ch.ok ? c.green('✓') : c.red('✗');
    err.write(`${mark} ${ch.label}${ch.detail ? c.dim(` — ${ch.detail}`) : ''}\n`);
  }
}

/** Show a completed request according to the flags. */
export function showResponse(ctx, sent, checks) {
  const { flags, out } = ctx;
  const { res } = sent;

  if (flags.verbose) printVerboseResponse(ctx, res);

  if (isJsonOutput(ctx)) {
    printJson(ctx, responseEnvelope(res, checks));
  } else {
    if (flags.include)
      out.write(`${res.status} ${res.statusText}\n${headerLines(res.headers).join('\n')}\n\n`);
    printBody(ctx, res);
  }

  if (!flags.silent && flags['output'] !== 'json') printFooter(ctx, sent);
  if (checks) printChecks(ctx, checks);
}
