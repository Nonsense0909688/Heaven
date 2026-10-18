# Environments and variables

This is the guide to making one request work everywhere: your laptop, staging,
production, and your teammate's machine.

---

## Environments

An **environment** is a named bundle of three things:

- a **base URL** (`https://staging.example.com`)
- some **variables** (`token`, `userId`, …)
- optional **default headers** sent on every request

```bash
heaven env set staging \
  --base-url https://staging.example.com \
  -v userId=42 \
  -v token='{{$env.STAGING_TOKEN}}' \
  -H "X-Client: heaven"
```

Then:

```bash
heaven env use staging            # make it the default
heaven get /users/{{userId}}      # → https://staging.example.com/users/42
heaven get /users/1 --env prod    # use another just this once
```

### Managing them

| Command | What it does |
|---|---|
| `heaven env set NAME ...` | Create or edit. Existing settings you don't mention are kept. |
| `heaven env use NAME` | Make `NAME` the active environment. |
| `heaven env list` | Show all, with `*` next to the active one. |
| `heaven env show [NAME]` | Show one in detail (secrets masked). |
| `heaven env rm NAME` | Delete it. If it was active, you'll have no active environment. |

Your **first** environment becomes active automatically.

### Which environment gets used?

1. `--env NAME` on the command, if given (the last one wins if repeated).
2. Otherwise the **active** environment.
3. Otherwise none, and then relative URLs like `/users` produce a helpful error.

---

## Variables

Write `{{name}}` almost anywhere in a request (URL, headers, query, auth, body,
form fields) and Heaven substitutes it just before sending.

```bash
heaven post /users --json '{"name":"{{name}}"}' --var name=Anish
```

### Two kinds

| Syntax | Comes from |
|---|---|
| `{{name}}` | `--var`, your environment, or a flow's extracted values |
| `{{$env.NAME}}` | your shell's environment variable called `NAME` |

`{{$env.NAME}}` is the secure choice: the secret lives in your shell, and files only
ever contain the *reference*.

### Who wins when names collide?

From weakest to strongest:

1. the environment's base URL
2. the environment's variables
3. values extracted by earlier steps in a [flow](testing-and-workflows.md#workflows)
4. `--var` flags on the command line

So `--var token=abc` always beats whatever the environment says.

### Variables inside variables

A variable's value can itself contain placeholders. Heaven resolves them up to five
levels deep:

```bash
heaven env set dev -v host=localhost -v api='http://{{host}}:3000'
```

### Missing variables

If anything can't be resolved, Heaven stops **before** sending and lists *all* the
missing names at once:

```
error: Unresolved variables: {{token}}, {{userId}}
  Define with --var name=value, or: heaven env set <env> --var name=value
```

### Removing a variable

Set it to nothing: `heaven env set dev -v token=`

### A one-off base URL

`--base-url http://localhost:9000` overrides the environment's base URL for a single
request. (On `env set`, the same flag *stores* it instead.)

---

## Setting secrets (the right way)

**Do this:**

```bash
# PowerShell
$env:STAGING_TOKEN = "s3cr3t"
# bash / zsh
export STAGING_TOKEN=s3cr3t

heaven env set staging -v token='{{$env.STAGING_TOKEN}}'
heaven get /me --bearer '{{token}}'
```

Nothing sensitive is written to disk, and the config file is safe to commit.

**Not this:**

```bash
heaven env set staging -v token=s3cr3t      # stored in plaintext!
```

Heaven will warn you, because any variable whose name looks secret-ish (`token`,
`password`, `secret`, `api_key`, `auth`, `credential`, `signature`) with a plain value
gets flagged.

> In PowerShell, remember `{{$env.X}}` needs **single quotes** so PowerShell doesn't
> try to expand `$env` itself.

---

## Default headers

Headers set on an environment go on every request sent through it. Headers on the
request itself win when names clash (comparison is case-insensitive).

```bash
heaven env set prod -H "X-Tenant: acme" -H "Accept-Language: en"
```

---

## Project-local data: sharing with your team

By default, Heaven stores everything in `~/.heaven`. To keep requests and environments
**with a project** instead:

```bash
cd my-project
heaven init
git add .heaven
git commit -m "Share our API requests"
```

`init` creates `.heaven/config.json` and `.heaven/requests.json` and writes a
`.gitignore` so `history.jsonl` stays local. Heaven searches upward from your current
folder for the nearest `.heaven/`, so it works from any subfolder.

Because secrets live in `{{$env.NAME}}` references, teammates only need to set the same
shell variables.

To point Heaven at a specific folder regardless of where you are, set `HEAVEN_HOME`:

```bash
export HEAVEN_HOME=/path/to/folder      # bash/zsh
$env:HEAVEN_HOME = "Z:\data\heaven"     # PowerShell
```

The order of precedence is: `HEAVEN_HOME` → nearest `.heaven/` → `~/.heaven`.

---

## What the files look like

`config.json`

```json
{
  "active": "staging",
  "envs": {
    "staging": {
      "baseUrl": "https://staging.example.com",
      "vars": { "userId": "42", "token": "{{$env.STAGING_TOKEN}}" },
      "headers": { "X-Client": "heaven" }
    }
  }
}
```

`requests.json`

```json
{
  "list-users": {
    "method": "GET",
    "url": "/users",
    "query": ["page=1"],
    "expect": { "status": 200 }
  }
}
```

They're ordinary JSON; edit them in your editor if that's easier than flags.
