// Send a template, show the result, and decide the exit code.
// Used by: <method>, run, replay.
import { HeavenError, EXIT } from '../core/errors.js';
import { last } from '../cli/value-parsers.js';
import { sendTemplate } from '../request/send.js';
import { evaluate } from '../assertions/evaluate.js';
import { checkOutputFlag, cliVarsFromFlags, applyInsecure } from './shared.js';
import { showResponse, printRequestVerbose } from './show-response.js';

/** Flags that control how the response body is consumed. */
function engineOptions(flags, out) {
  const engine = {};
  if (flags['output-file']) engine.outputFile = flags['output-file'];       // stream to disk
  if (flags.stream) engine.onChunk = (chunk) => out.write(chunk);           // print as it arrives
  if (flags['max-buffer'] !== undefined) {
    const megabytes = Number(flags['max-buffer']);
    if (!(megabytes > 0)) throw new HeavenError('--max-buffer must be a positive number of megabytes');
    engine.maxBuffer = Math.floor(megabytes * 1024 * 1024);
  }
  return engine;
}

/** 0 ok · 4 expectation failed · 2 HTTP error (unless the user expected a status or passed --no-fail). */
function exitCodeFor(res, template, checks, flags) {
  if (checks && !checks.passed) return EXIT.ASSERT;
  const userExpectedStatus = template.expect?.status !== undefined;
  if (res.status >= 400 && !userExpectedStatus && !flags['no-fail']) return EXIT.HTTP;
  return EXIT.OK;
}

export async function execute(ctx, template, { historyName, envName } = {}) {
  const { flags, err, c, out } = ctx;
  checkOutputFlag(flags);

  if (flags.insecure) {
    applyInsecure(flags);
    err.write(c.yellow('warning: TLS certificate verification is disabled (--insecure)\n'));
  }

  const sent = await sendTemplate(ctx.store, template, {
    envName: envName ?? last(flags.env),
    cliVars: cliVarsFromFlags(flags),
    engine: engineOptions(flags, out),
    historyName,
    record: !flags['no-history'],
    onPrepared: flags.verbose ? (resolved) => printRequestVerbose(ctx, resolved) : undefined,
  });

  const checks = template.expect ? evaluate(template.expect, sent.res) : null;
  showResponse(ctx, sent, checks);
  return exitCodeFor(sent.res, template, checks, flags);
}
