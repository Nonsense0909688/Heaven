# Testing, workflows and benchmarking

Heaven isn't only for poking at APIs. It can *check* them too, from a single
expectation on one request up to a full multi-step scenario.

- [Expectations](#expectations): turn any request into a test
- [Workflows](#workflows): chain requests and pass data between them
- [Benchmarking](#benchmarking): how fast, and how reliably?
- [Using Heaven in CI](#using-heaven-in-ci)

---

## Expectations

Add `--expect-*` flags to any request. Heaven sends it, checks the response, prints a
✓ or ✗ for each check, and exits with code `4` if anything failed.

```bash
heaven get /users/1 \
  --expect-status 200 \
  --expect-json name=Anish \
  --expect-json 'age>17' \
  --expect-contains Anish \
  --expect-time 500
```

```
✓ status is 200
✓ json name = "Anish"
✓ json age > 17
✓ body contains "Anish"
✓ response time ≤ 500 ms
```

When something's off, you're told what was expected *and* what was found:

```
✗ json name = "Anish" — got "Anna"
✗ status is 200 — got 404
✗ response time ≤ 300 ms — took 412 ms
```

### The checks

| Flag | Passes when… |
|---|---|
| `--expect-status 200` | status is exactly 200 |
| `--expect-status 200,201` | status is one of them |
| `--expect-status 2xx` | status is in that class (`1xx`–`5xx`) |
| `--expect-time 300` | the whole response arrived within 300 ms |
| `--expect-contains TEXT` | the body contains the text (repeatable) |
| `--expect-json PATH` | something exists at that path |
| `--expect-json PATH=VALUE` | the value equals `VALUE` |
| `--expect-json PATH!=VALUE` | the value differs (or is missing) |
| `--expect-json PATH>N` / `PATH<N` | the number is greater / less than N |
| `--expect-json PATH~REGEX` | the value matches the regular expression |

`--expect-json` is repeatable, so use as many as you like.

### Paths

Paths use a tiny, familiar syntax:

```
user.name              a key inside an object
items[0].id            an array element
["odd key"].x          keys with spaces or dots
$.data.id              a leading $ or $. is allowed and ignored
```

### How values are compared

`VALUE` is read as JSON when it can be, so `count=5` compares to the number 5,
`active=true` to the boolean, and `tags=["a","b"]` to an array. Otherwise it's plain
text. Scalars are compared loosely enough that `id=5` matches both `5` and `"5"`;
objects and arrays are compared deeply.

### A note on status codes

If you *don't* set `--expect-status`, a 4xx/5xx is a failure (exit 2). If you *do*,
Heaven trusts you: expecting `404` and getting `404` is a pass. This makes it easy to
test error paths.

```bash
heaven get /users/does-not-exist --expect-status 404 --expect-json error~'not found'
```

### Saving expectations

Expectations are part of the template, so they're saved with the request:

```bash
heaven save health get /health --expect-status 200 --expect-time 300
heaven run health          # runs the checks every time
```

---

## Workflows

A **flow** is a JSON file describing ordered steps. Each step sends a request, can check
the response, and can **extract** values that later steps use as `{{variables}}`. It's
how you test things like "log in, then fetch my profile, then update it."

```bash
heaven flow checkout.json
heaven flow checkout.json --env staging --var user=anish
heaven flow checkout.json --output json
```

### A complete example

```json
{
  "name": "login then fetch profile",
  "env": "staging",
  "vars": { "user": "anish" },
  "steps": [
    {
      "name": "login",
      "method": "POST",
      "url": "/login",
      "json": { "user": "{{user}}", "password": "{{$env.PASS}}" },
      "expect": { "status": 200 },
      "extract": { "token": "body.access_token" }
    },
    {
      "name": "me",
      "method": "GET",
      "url": "/me",
      "bearer": "{{token}}",
      "expect": { "status": 200, "json": { "user": "anish" }, "maxTime": 500 }
    }
  ]
}
```

What you'll see:

```
login then fetch profile
 ✓ 1. login  POST /login  200  84 ms  → token
 ✓ 2. me  GET /me  200  41 ms

PASSED  2/2 steps passed
```

### Top-level fields

| Field | Meaning |
|---|---|
| `name` | A title for the report (optional). |
| `env` | Default environment (`--env` on the command line wins). |
| `vars` | Starting variables for the whole flow. |
| `continueOnError` | `true` to keep going after a failed step (default: stop). |
| `steps` | The list of steps (required, at least one). |

### Step fields

A step is either **inline** or based on a **saved request**, plus optional overrides.

| Field | Meaning |
|---|---|
| `name` | Label shown in the report. |
| `use` | Name of a saved request to start from. |
| `method`, `url` | Required unless `use` supplies them. Method defaults to GET. |
| `headers` | Object of header names to values. |
| `query` | Object (`{"page":2}`) or list (`["page=2"]`). |
| `json` / `data` / `form` | The body (object or string for `json`, string for `data`, object or list for `form`). |
| `bearer` / `basic` | Authentication. |
| `timeout` | Milliseconds. |
| `expect` | Checks (see below). |
| `extract` | Values to capture (see below). |
| `continueOnError` | Keep going if *this* step fails. |

Using a saved request keeps flows short:

```json
{ "name": "create", "use": "create-user", "json": { "name": "{{user}}" } }
```

### `extract`: passing data forward

```json
"extract": {
  "token":  "body.access_token",
  "userId": "body.data.id",
  "first":  "body.items[0].id",
  "where":  "headers.location",
  "code":   "status"
}
```

Later steps can write `{{token}}`, `{{userId}}`, and so on. If you extract an object or
array, it's stored as JSON text. If a value can't be found, that step fails with
`extract token from body.access_token — not found in response`.

### `expect` in flows

```json
"expect": {
  "status": 200,                       // or "2xx", or [200, 201]
  "maxTime": 500,                      // milliseconds
  "contains": "welcome",               // or a list
  "headers": { "content-type": "application/json", "x-trace-id": true },
  "json": { "user": "anish", "items[0].id": 1 }
}
```

- `headers`: a value means "equals (case-insensitive)", `true` means "exists".
- `json` can be a simple **map** of path → expected value, or a **list** for the richer
  checks: `{ "path": "n", "gt": 3 }`, `{ "path": "name", "matches": "^An" }`,
  `{ "path": "id", "type": "number" }`, `{ "path": "x", "exists": true }`,
  `{ "path": "y", "notEquals": 0 }`, `{ "path": "z", "lt": 10 }`.
- A step with **no** `expect.status` automatically gets a "status is not an error" check.

### What happens on failure

By default the flow **stops at the first failing step**, and the remaining steps are
reported as skipped. Set `continueOnError` on a step (or the whole flow) to carry on.

The flow's exit code is the code of the **first** failure:

| Code | Why |
|---|---|
| `0` | everything passed |
| `2` | the only problem was an HTTP 4xx/5xx |
| `3` | a network problem (step marked `ERR`) |
| `4` | an expectation or extraction failed |

Problems with the *flow file itself* (bad JSON, missing `url`, unresolved variables)
stop the run immediately with exit `1` and a clear message.

---

## Benchmarking

```bash
heaven bench get /health -n 500 -c 25
heaven bench list-users -n 200 -c 20 --max-p95 250
```

`-n` is the total number of requests; `-c` is how many run at once. Heaven reads and
discards each response body, so memory stays flat no matter how big the replies are.

```
requests   500 in 1.84 s  (271.74 req/s)
errors     0
status     200×500
latency    min 4.1 · mean 18.3 · p50 15.2 · p90 31.0 · p95 40.5 · p99 72.2 · max 98.7  (ms)
✓ p95 within 250 ms
```

How to read it:

- **p50** is the typical request; **p95** and **p99** show your slow tail.
  Averages hide spikes. Watch the percentiles.
- **errors** counts both network failures and 4xx/5xx answers.
- If requests failed, the distinct error messages are listed with counts.

Exit code `2` means at least one request failed; `4` means `--max-p95` was exceeded.
`--silent` hides the progress and header lines, and `--output json` gives the whole
report as JSON.

> Be kind to servers. Benchmark things you own, preferably not production at peak hours.

---

## Using Heaven in CI

Because everything is driven by exit codes, Heaven drops straight into a pipeline:

```yaml
# GitHub Actions example
- name: API smoke tests
  run: |
    heaven env set ci --base-url ${{ vars.API_URL }} -v token='{{$env.API_TOKEN}}'
    heaven flow tests/smoke.json --env ci --no-history
    heaven bench get /health -n 100 -c 10 --max-p95 300 --env ci --silent
  env:
    API_TOKEN: ${{ secrets.API_TOKEN }}
```

Tips:

- `--no-history` keeps CI runs out of the log.
- `--output json` gives machine-readable results to archive or parse.
- Commit your `.heaven/` folder (via `heaven init`) so the pipeline uses the same
  saved requests as your team, and supply secrets through environment variables.
