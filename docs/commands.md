# Command reference

Every command, what it does, and the flags that matter for it. Examples are meant to
be copied and tried.

> Tip: `heaven help <command>` prints a short version of each section right in your
> terminal.

**Jump to:**
[Sending requests](#sending-requests) ·
[Saved requests](#saved-requests) ·
[Environments](#environments) ·
[History and replay](#history-and-replay) ·
[Compare](#compare) ·
[Flow](#flow) ·
[Bench](#bench) ·
[Init](#init) ·
[All flags](#all-flags-at-a-glance)

---

## Sending requests

```
heaven get|post|put|patch|delete|head|options URL [options]
heaven URL [options]                    # shortcut for GET
```

```bash
heaven get https://api.github.com/users/octocat
heaven post /users --json '{"name":"Anish"}'
heaven put /users/7 --json @update.json -H "If-Match: abc"
heaven delete /users/7 --expect-status 204
heaven get /search -q term=cats -q limit=10 -i
heaven get /report -o report.pdf
```

Everything about bodies, headers, auth and output is in [DOCS.md](../DOCS.md#sending-requests).

**Exit codes:** `0` ok · `2` the server returned 4xx/5xx · `3` network problem ·
`4` an `--expect-*` failed.

---

## Saved requests

### `heaven save NAME [METHOD] URL [options]`

Stores a request **template** under `NAME`. Placeholders like `{{token}}` are kept
as-is, so the request works in any environment. The method is optional and defaults to GET.

```bash
heaven save health get /health
heaven save login post /login --json '{"user":"anish","password":"{{$env.PASS}}"}'
heaven save list-users get /users -q page=1 --expect-status 200
```

Names can use letters, digits, dots, dashes and underscores.

If you save a literal secret, Heaven warns you and suggests `{{$env.NAME}}`.
Saving over an existing name updates it (and tells you it did).

### `heaven save NAME --last [overrides]`

Saves your most recent history entry. This only works if that request had no secrets
scrubbed out of it. Otherwise Heaven explains exactly what to re-supply.

### `heaven run NAME [overrides]`

Sends a saved request. Any request flag you add **overrides** the saved value:

```bash
heaven run list-users
heaven run list-users --env prod --var id=42 -H "X-Debug: 1" -i
heaven run list-users -q page=2          # replaces the saved page=1
```

How overriding works: headers match by name (case-insensitively), query params match
by key, and body/auth/timeout/expectations replace outright.

### `heaven list [TEXT]`  (alias `ls`)

Shows saved requests. Give it text (or `--search TEXT`) to filter by name or URL.
`--output json` for machines.

### `heaven rm NAME`

Deletes a saved request.

---

## Environments

```
heaven env set NAME [--base-url URL] [-v key=value]... [-H "Header: value"]...
heaven env use NAME
heaven env list          (alias: ls)
heaven env show [NAME]
heaven env rm NAME
```

```bash
heaven env set dev --base-url http://localhost:3000
heaven env set prod --base-url https://api.example.com \
  -v token='{{$env.PROD_TOKEN}}' -H "X-Client: heaven"
heaven env use prod
heaven env show
heaven env list
```

Good to know:

- `env set` on an existing name **edits it**, keeping whatever you don't mention.
- The first environment you create automatically becomes the active one.
- `-v key=` (empty value) **removes** that variable.
- `env show` hides the values of secret-looking variables and masks sensitive headers.
- Variables that look like secrets but hold plain text trigger a warning at `set` time.

The full story is in [environments-and-variables.md](environments-and-variables.md).

---

## History and replay

```
heaven history [--limit 20] [--search TEXT]
heaven history show ID
heaven history clear
heaven replay ID [overrides]
```

History records **what you sent** (with secrets scrubbed) and **a little about the
answer** (status, time, size, content type). It never stores response bodies.

```bash
heaven history                      # last 20 entries, newest at the bottom
heaven history --search /users      # filter
heaven history show 12              # one entry in full
heaven replay 12                    # send #12 again
heaven replay 12 --env staging      # …somewhere else
```

Each entry remembers the environment it used. `replay` uses it again unless you pass
`--env` (and if that environment has since been deleted, Heaven warns and falls back
to your active one).

If the original request had secrets, `replay` stops and lists exactly where they were
scrubbed, so you can re-supply them. The lasting fix is to use `{{variables}}`: then
the stored template is complete and replays with no extra flags.

The log keeps itself tidy: past 1000 entries it trims down to the newest 800.
Pass `--no-history` to any send command to skip recording.

---

## Compare

```
heaven compare NAME --env A --env B [--ignore a,b.c,items[*].id] [--headers]
heaven compare get /users --env dev --env prod
```

Sends the **same request to both environments at the same time** and reports:

- **status**: same or different
- **time** and **size**: shown for interest, but *never* counted as a difference
- **body**: for JSON, field-by-field (`~` changed, `+` only in B, `-` only in A, plus
  a note when a value's type changed). Text bodies are compared directly and binary
  ones by hash.
- **headers** (only with `--headers`): volatile ones like `Date`, `Set-Cookie`,
  `X-Request-Id` and `CF-Ray` are skipped automatically.

`--ignore` accepts, comma-separated or repeated:

| Pattern | Ignores |
|---|---|
| `updatedAt` | any key called `updatedAt`, at any depth |
| `user.id` | exactly that path |
| `items[*].id` | `id` in every item of `items` |
| `meta.*` | everything under `meta` |

**Exit codes:** `0` identical · `5` differences found · `3` one side couldn't be reached.
Add `--output json` for a machine-readable report. Compares are not saved to history.

> Differences aren't necessarily bugs. Dev and prod are *supposed* to differ in places.

---

## Flow

```
heaven flow FILE.json [--env NAME] [--var k=v] [--output json]
```

Runs a multi-step workflow. See [testing-and-workflows.md](testing-and-workflows.md#workflows)
for the full file format. Each step prints a ✓ or ✗ line as it completes, then you get
a `PASSED`/`FAILED` summary.

**Exit codes:** `0` all steps passed · `2` a step only failed on an HTTP error ·
`3` network failure · `4` an expectation or extraction failed.

---

## Bench

```
heaven bench NAME|URL [-n 100] [-c 10] [--max-p95 MS] [--output json]
heaven bench get /health -n 500 -c 25
heaven bench list-users -n 200 -c 20 --max-p95 250
```

Fires `-n` requests (default 100, max 100,000) with at most `-c` in flight at once
(default 10, max 1000). Bodies are read and thrown away, so it's safe to point at large
responses. You get request count and duration, requests per second, a status histogram,
error rate, and latency (min, mean, p50, p90, p95, p99, max).

**Exit codes:** `0` fine · `2` at least one request failed · `4` p95 exceeded `--max-p95`.
Benchmarks are never written to history.

> Only load-test servers you own or have permission to test.

---

## Init

```
heaven init
```

Creates a `.heaven/` folder **in the current directory** with an empty `config.json` and
`requests.json`, and a `.gitignore` that excludes `history.jsonl`. From then on, any
`heaven` command run inside this project (or its subfolders) uses that folder instead
of your global one, so your team can commit shared requests and environments.

---

## All flags at a glance

| Short | Long | Takes | Notes |
|---|---|---|---|
| `-H` | `--header` | `"Name: value"` | repeatable |
| `-q` | `--query` | `key=value` | repeatable |
| `-F` | `--form` | `name=value` or `name=@file` | repeatable |
| `-v` | `--var` | `key=value` | repeatable |
| `-e` | `--env` | environment name | repeatable (twice for `compare`) |
| | `--json` | body or `@file` | |
| `-d` | `--data` | body or `@file` | |
| | `--upload` | file | |
| | `--bearer` | token | |
| | `--basic` | `user:pass` | |
| `-t` | `--timeout` | milliseconds | default 30000 |
| | `--base-url` | URL | one-off base URL (`env set` stores it) |
| `-o` | `--output-file` | file | stream body to disk |
| | `--output` | `json` | machine-readable output |
| | `--max-buffer` | megabytes | default 10 |
| | `--expect-status` | `200`, `200,201`, `2xx` | |
| | `--expect-json` | `path`, `path=v`, `path!=v`, `path>n`, `path<n`, `path~regex` | repeatable |
| | `--expect-contains` | text | repeatable |
| | `--expect-time` | milliseconds | |
| | `--ignore` | `a,b.c,items[*].id` | `compare` only; repeatable |
| `-n` | `--count` | number | `bench` |
| `-c` | `--concurrency` | number | `bench` |
| | `--max-p95` | milliseconds | `bench` |
| | `--limit` | number | `history` |
| | `--search` | text | `list`, `history` |
| `-i` | `--include` | | print response headers |
| `-V` | `--verbose` | | show request and headers |
| `-s` | `--silent` | | hide status line |
| `-k` | `--insecure` | | skip TLS verification |
| `-h` | `--help` | | |
| | `--version` | | |
| | `--raw` / `--pretty` | | body formatting |
| | `--stream` | | print body as it arrives |
| | `--headers` | | `compare`: also diff headers |
| | `--last` | | `save`: use last request |
| | `--no-follow` | | don't follow redirects |
| | `--no-fail` | | exit 0 even on 4xx/5xx |
| | `--no-history` | | don't record |
| | `--no-color` | | plain output |

Short flags can be bundled (`-ik`) and values can be attached (`-Hfoo:bar`, `-n50`).
`--flag=value` works for long flags, and `--` ends flag parsing.
