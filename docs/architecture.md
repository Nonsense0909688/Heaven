# How the code is organised

This page is for people who want to read, change, or extend Heaven. If you only use it,
you can skip it.

---

## The big picture

```
You type:  heaven run login --env prod
              │
              ▼
          cli.js         parse flags, build a context, catch errors → exit code
              │
              ▼
          router.js      "run" → cmdRun
              │
              ▼
        commands/        read flags, call the logic, print results
              │
      ┌───────┼──────────────┐
      ▼       ▼              ▼
  request/  features/     render/
  (build &  (compare,     (colours,
   send)     flow, bench)  tables)
      │
      ▼
   http/  ·  assertions/  ·  security/  ·  storage/
      │
      ▼
   core/   (errors, paths, variables)
```

**The rule:** layers only call *down*, never up. `core/` knows nothing about the rest;
`features/` never print or read flags; only `commands/` talk to the user.

---

## The folders

```
bin/heaven.js           executable entry point (calls src/cli.js)
src/
  cli.js                main(): parse args → build ctx → dispatch → map errors to exit codes
  router.js             command word → command function

  core/                 tiny, dependency-free building blocks
    errors.js             HeavenError, NetworkError, EXIT codes
    jsonpath.js           "a.b[0].c" path language
    variables.js          {{placeholder}} resolver

  cli/                  command-line parsing and help
    flag-definitions.js   every flag, in one table
    parse-args.js         argv → { _, flags }
    value-parsers.js      key=value, "Header: v", last()
    help.js               help text

  request/              "what are we sending?"
    template.js           flags → template, merging templates
    prepare.js            template + env + vars → resolved request
    url.js · headers.js · body.js     pieces of prepare
    send.js               prepare → HTTP → history (used by every command)

  http/                 "actually sending it"
    engine.js             executeRequest()
    request-body.js       body → fetch init
    read-body.js          stream to file / hand over chunks / discard / buffer
    decode-body.js        text / JSON / binary
    network-errors.js     friendly messages for DNS, TLS, timeouts…

  assertions/           --expect-* and flow `expect`
    parse.js              flags → expectation
    evaluate.js           expectation + response → list of checks

  security/             secret handling
    patterns.js           what counts as sensitive
    redact.js             make a template safe to store
    inspect.js            find secrets / list redacted places

  storage/              everything on disk
    store.js              the one object commands use
    json-file.js          safe read/write of JSON
    history-log.js        append-only JSON-lines history
    locate-home.js        $HEAVEN_HOME → ./.heaven → ~/.heaven

  features/             self-contained capabilities
    compare/              diff-json, diff-headers, compare-responses
    flow/                 run-flow, step-template, extract
    bench/                run-bench, stats

  render/               colours, tables, formatting (pure presentation)

  commands/             one file per command group
    execute.js · show-response.js       sending + printing
    request.js · saved-requests.js · env.js · history.js
    compare.js · flow.js · bench.js · init.js
    shared.js · index.js
```

---

## Following one request through the code

`heaven get /users -H "X-A: 1" --expect-status 200`

1. **`cli/parse-args.js`** turns the argv into `{ pos: ['get','/users'], flags: {...} }`.
2. **`router.js`** sees `get` is an HTTP method and calls `cmdRequest`.
3. **`request/template.js`** builds a *template* from the flags (method, URL, headers,
   expectation).
4. **`commands/execute.js`** hands it to `request/send.js`.
5. **`send.js`** picks the environment, builds the variable set, and calls
   **`request/prepare.js`**, which resolves `{{vars}}`, joins the base URL, adds query,
   auth and body, and returns a *resolved request*.
6. **`http/engine.js`** sends it with `fetch`, reads the body in a memory-safe way, and
   returns a normalized *response*.
7. **`send.js`** writes a *redacted* copy of the template to history.
8. **`assertions/evaluate.js`** checks the expectation.
9. **`commands/show-response.js`** prints the body (stdout) and the status line and
   checks (stderr).
10. **`execute.js`** converts the outcome into an exit code.

---

## Recipes

### Add a new flag

1. Add one line to `cli/flag-definitions.js`.
2. Read `flags['your-flag']` in the command that needs it.
3. Mention it in `cli/help.js` and `docs/commands.md`.

### Add a new command

1. Create `commands/mycommand.js` exporting `cmdMycommand(ctx)` that returns an exit code.
2. Export it from `commands/index.js`.
3. Add a line to `COMMAND_TABLE` in `router.js`.
4. Add its help text to `COMMANDS` in `cli/help.js`.

### Add a new kind of check (`--expect-…`)

1. Parse the flag in `assertions/parse.js` (`expectFromFlags`).
2. Add a `checkSomething()` function in `assertions/evaluate.js` and call it from
   `evaluate()`.

Each check returns `{ ok, label, detail? }`, and everything that prints checks (single
requests, flows) picks it up automatically.

### Add a new JSON operator (`path^=…`)

Add a branch in `parseJsonExpect`, then add an entry to the `JSON_CHECKS` table in
`evaluate.js` and teach `pickJsonCheck` when to use it.

### Add a new body type

Add a builder to the `BUILDERS` table in `request/body.js` and, if `fetch` needs special
handling, a case in `http/request-body.js`.

---

## Conventions

- **ES modules**, Node 20+, no dependencies.
- **Errors for users** are `HeavenError` (with an exit code). Anything else is treated as
  a bug and reported as "unexpected error".
- **stdout is data, stderr is chatter.** Never print diagnostics to stdout.
- **Functions return exit codes** instead of calling `process.exit`, which keeps them
  testable. `cli.js` accepts custom `stdout`/`stderr` streams for the same reason.
- **Comments explain *why***, and every file starts with a one-paragraph summary of its job.
