# Heaven Documentation

Welcome! This is the complete guide to Heaven. If you just want to get going,
the [README](README.md) is a faster read. Come back here when you want the details.

**Contents**

1. [How Heaven thinks](#how-heaven-thinks)
2. [Sending requests](#sending-requests)
3. [Reading the output](#reading-the-output)
4. [Saving, replaying, comparing](#saving-replaying-comparing)
5. [Environments and variables](#environments-and-variables)
6. [Testing your API](#testing-your-api)
7. [Keeping secrets safe](#keeping-secrets-safe)
8. [Where Heaven keeps its files](#where-heaven-keeps-its-files)
9. [Exit codes](#exit-codes)
10. [Environment variables Heaven reads](#environment-variables-heaven-reads)
11. [Troubleshooting](#troubleshooting)

Deeper guides:
[Command reference](docs/commands.md) ·
[Environments & variables](docs/environments-and-variables.md) ·
[Testing & workflows](docs/testing-and-workflows.md) ·
[Windows setup](docs/windows-setup.md) ·
[Architecture](docs/architecture.md)

---

## How Heaven thinks

Three ideas explain almost everything.

### 1. A request is a _template_ first

When you type `heaven post /login --json '{"user":"{{user}}"}'`, Heaven doesn't
immediately send that text. It first builds a **template**: the method, URL,
headers, body and so on, with any `{{placeholders}}` left as they are.

Only at the last moment does Heaven fill in the placeholders using your
environment and variables, producing the real request.

Why bother? Because a template can be **saved**, **replayed**, and **pointed at a
different environment** without changing it. The same `login` request works on
dev, staging and prod; only the variables differ.

### 2. Environments are named bundles of settings

An environment holds a base URL, some variables, and maybe default headers.
You make one per place your API lives (`dev`, `staging`, `prod`), then pick with
`--env` or `heaven env use`.

### 3. Data and chatter are kept apart

Whatever you might want to pipe (the response body, JSON reports) goes to
**stdout**. Everything meant for a human glancing at the screen (status line,
timings, warnings, check marks) goes to **stderr**. That's why this works cleanly:

```bash
heaven get /users | jq '.[0].name'
```

---

## Sending requests

```
heaven METHOD URL [options]
```

`METHOD` is `get`, `post`, `put`, `patch`, `delete`, `head` or `options`.
As a shortcut, if you start with a URL, Heaven assumes `GET`:

```bash
heaven /users                       # same as: heaven get /users
heaven https://example.com/health
heaven localhost:3000/ping
```

### URLs

| You type                                                                | Heaven sends to                            |
| ----------------------------------------------------------------------- | ------------------------------------------ |
| `https://api.example.com/x`                                             | exactly that                               |
| `/users` (with an active env whose base URL is `http://localhost:3000`) | `http://localhost:3000/users`              |
| `localhost:3000/x` or `127.0.0.1:8080/x`                                | `http://…`                                 |
| `example.com/x`                                                         | `https://example.com/x`                    |
| `/users` with no base URL anywhere                                      | a helpful error telling you how to set one |

### Adding things to a request

```bash
heaven get /users -q page=2 -q limit=50        # ?page=2&limit=50
heaven get /me -H "X-Debug: 1"                 # a header
heaven get /me --bearer {{token}}              # Authorization: Bearer …
heaven get /admin --basic admin:hunter2        # Authorization: Basic …
```

### Sending a body

Pick **one** of these per request:

| Flag                                      | What it does                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `--json '{"a":1}'` or `--json @file.json` | Sends JSON. Heaven checks it's valid first and sets `Content-Type` and `Accept`.                             |
| `-d 'a=1&b=2'` or `-d @file`              | Sends raw text. Looks like a form? It's sent as `application/x-www-form-urlencoded`. Otherwise `text/plain`. |
| `-F name=value -F photo=@pic.png`         | A multipart form. `@` means "upload this file".                                                              |
| `--upload big.zip`                        | Streams one file as the entire body (never loaded into memory).                                              |

> **PowerShell users:** quoting JSON on the command line is painful. Put it in a
> file and use `--json @body.json`. It saves a lot of grief.

### Handy switches

| Flag               | Meaning                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| `-t, --timeout MS` | Give up after this many milliseconds (default 30000).                         |
| `--no-follow`      | Don't follow redirects.                                                       |
| `-k, --insecure`   | Skip TLS certificate checks. Only for servers you trust. Heaven warns loudly. |
| `--no-history`     | Don't record this request in history.                                         |
| `--no-fail`        | Exit `0` even on a 4xx/5xx response.                                          |

---

## Reading the output

By default Heaven prints the body to stdout and a status line to stderr:

```
{ "id": 1, "name": "Anish" }
200 OK · 84 ms · 312 B · history #42
```

| Flag                     | Effect                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `-i, --include`          | Also print the response status and headers before the body.                                                                 |
| `-V, --verbose`          | Show the request and all headers on stderr, plus time-to-first-byte.                                                        |
| `-s, --silent`           | Hide the status line. (Failed checks still print. You always find out _why_.)                                               |
| `--pretty` / `--raw`     | Force pretty-printed JSON, or leave the body exactly as received. In a terminal, JSON is pretty and coloured automatically. |
| `-o, --output-file FILE` | Stream the body to a file. Perfect for downloads.                                                                           |
| `--stream`               | Print the body chunk by chunk as it arrives (Server-Sent Events, NDJSON…).                                                  |
| `--max-buffer MB`        | How much of the body to hold in memory (default 10). Anything bigger is cut off, with a note.                               |
| `--output json`          | One tidy JSON object with the status, headers, body, timings and check results. Made for scripts.                           |
| `--no-color`             | Plain text. (`NO_COLOR=1` works too.)                                                                                       |

Binary bodies (images, PDFs, zips…) aren't dumped to your terminal. Heaven tells you
the size and suggests `-o`.

---

## Saving, replaying, comparing

```bash
heaven save create-user post /users --json @user.json
heaven run create-user                    # send it again
heaven run create-user --env prod -H "X-Debug: 1"
heaven list                               # see everything you've saved
heaven rm create-user
```

Anything you pass to `run` **overrides** what was saved, so you rarely need a second
copy of a request just to change one header.

Heaven also remembers what you've _sent_ in a history (never the responses):

```bash
heaven history                    # the last 20
heaven history show 12            # one entry in full
heaven replay 12                  # send it again
heaven save my-thing --last       # promote your most recent request to a saved one
```

And you can ask "do dev and prod behave the same?":

```bash
heaven compare get-user --env dev --env prod --ignore updatedAt
```

Full details for every command are in the [command reference](docs/commands.md).

---

## Environments and variables

```bash
heaven env set staging --base-url https://staging.example.com
heaven env set staging -v token='{{$env.STAGING_TOKEN}}'
heaven env use staging
```

Anywhere in a URL, header, query, or body you can write `{{name}}` and Heaven fills
it in. `{{$env.NAME}}` reads from your shell's environment, which is the best way to
handle secrets.

The whole story (precedence rules, default headers, sharing with your team) is in
[docs/environments-and-variables.md](docs/environments-and-variables.md).

---

## Testing your API

Add expectations to any request and Heaven turns it into a test:

```bash
heaven get /users/1 \
  --expect-status 200 \
  --expect-json name=Anish \
  --expect-json 'age>17' \
  --expect-time 500
```

Failed expectations print a ✗ with the reason and exit with code `4`.

For multi-step scenarios ("log in, then fetch my profile") write a **flow**:
a small JSON file where each step can pull values out of earlier responses.
For load testing, use `heaven bench`. Both are covered in
[docs/testing-and-workflows.md](docs/testing-and-workflows.md).

---

## Keeping secrets safe

Heaven tries hard to stop you leaking credentials by accident.

- **History is redacted.** Before a request is written to history, Heaven replaces
  secret-looking values (the `Authorization` header, `--bearer`/`--basic`, query
  params or JSON fields named `token`, `password`, `secret`, `api_key`, …) with
  `[REDACTED]`. Response bodies are never stored at all.
- **Placeholders are never redacted**, because they aren't secrets. `{{token}}` and
  `{{$env.API_KEY}}` are safe to store and replay.
- **Warnings before you save secrets.** If you `save` a request or `env set` a
  variable containing a literal secret, Heaven warns you and suggests the
  `{{$env.NAME}}` form.
- **Verbose mode masks too.** `-V` hides credentials in the headers it prints.
- **Data files are private.** Heaven creates its folder with owner-only permissions
  where the OS supports it.

**The golden rule:** put secrets in your shell's environment and refer to them as
`{{$env.NAME}}`. Then nothing sensitive ever touches a file.

---

## Where Heaven keeps its files

Heaven looks for its data folder in this order:

1. **`$HEAVEN_HOME`**, if you've set it.
2. The nearest **`.heaven/`** folder in the current directory or any parent
   (so a project can carry its own requests and environments).
3. **`~/.heaven`** in your home directory.

Inside you'll find:

| File            | What's in it                                                                               |
| --------------- | ------------------------------------------------------------------------------------------ |
| `config.json`   | Your environments and which one is active.                                                 |
| `requests.json` | Your saved requests.                                                                       |
| `history.jsonl` | What you've sent (redacted), one entry per line. Trimmed automatically after 1000 entries. |

They're plain JSON, so you can read and edit them by hand. If one gets corrupted,
Heaven tells you which file and why, and never overwrites it silently.

---

## Exit codes

Scripts and CI can read these to know _why_ something failed.

| Code | Meaning                                                                                    |
| ---- | ------------------------------------------------------------------------------------------ |
| `0`  | All good.                                                                                  |
| `1`  | You used Heaven wrong: bad flag, bad config, unresolved `{{variable}}`, invalid JSON body. |
| `2`  | The server answered with a 4xx/5xx. (For `bench`: at least one request failed.)            |
| `3`  | Couldn't get an answer: DNS failure, connection refused, TLS problem, or timeout.          |
| `4`  | A check failed: an `--expect-*`, a flow step, or `--max-p95`.                              |
| `5`  | `compare` found differences.                                                               |

If you passed `--expect-status 404`, getting a 404 is _success_. Heaven won't
report exit code `2` for a status you said you expected.

---

## Environment variables Heaven reads

| Variable       | Effect                                                         |
| -------------- | -------------------------------------------------------------- |
| `HEAVEN_HOME`  | Use this folder for data instead of searching for `.heaven`.   |
| `HEAVEN_DEBUG` | Set to anything to see full stack traces on unexpected errors. |
| `NO_COLOR`     | Turn colours off.                                              |
| `FORCE_COLOR`  | Keep colours on even when output is piped.                     |

---

## Troubleshooting

**"command not found: heaven"**
The link worked but your shell can't find it. On Windows, see
[docs/windows-setup.md](docs/windows-setup.md). Everywhere else, run `npm prefix -g`
and make sure its `bin` folder is on your PATH. Or just use `node bin/heaven.js …`.

**"`/users` is a relative URL but no base URL is set"**
Create an environment: `heaven env set dev --base-url http://localhost:3000`. If you
already have one, make sure it's active (`heaven env list` shows a `*`) or pass `--env`.

**"Unresolved variable: {{token}}"**
Define it: `--var token=abc` for one request, or `heaven env set dev -v token=abc`
for good. Heaven lists _every_ missing variable at once.

**"--json body is not valid JSON"**
Usually a shell-quoting problem, especially in PowerShell. Put the JSON in a file and
use `--json @body.json`.

**"Connection refused … Is the server running?"** (exit 3)
Nothing is listening at that address. Check the port and that your server is up.

**"TLS certificate verification failed"** (exit 3)
The server's certificate isn't trusted. If it's a local or test server you trust, add
`--insecure`. Never use it against something you don't control.

**"Request #12 contained secrets that were redacted"**
`replay` and `save --last` can't invent the secrets Heaven scrubbed. Supply them again
(`--bearer …`, `-H …`), or better, switch the original request to `{{variables}}`.

**Output looks odd or has colour codes in a file**
Use `--no-color` or set `NO_COLOR=1`.

**Something unexpected?**
Run it again with `HEAVEN_DEBUG=1` and `-V`. That shows exactly what was sent and
where an error came from.
