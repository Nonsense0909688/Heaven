# Heaven ☁️

**Your terminal API workshop.**

Heaven is a small command-line tool for talking to APIs. Send a request, save it
so you never retype it, point it at dev or prod with one flag, compare the two,
chain requests into a workflow, and load-test the result. All from your terminal,
with no app to open and no account to create.

```bash
heaven get https://api.github.com/users/octocat
```

That's it. That's a request. The rest of this page shows you what else you can do.

---

## Install

You need [Node.js](https://nodejs.org) version 20 or newer.

```bash
cd heaven
npm link
```

Now `heaven` (and the short alias `hv`) work anywhere on your machine.

> **On Windows and it says "command not found"?** That's a very common PATH quirk,
> and it's easy to fix. See [docs/windows-setup.md](docs/windows-setup.md).

Not ready to link it? You can always run it directly:

```bash
node bin/heaven.js get https://api.github.com/users/octocat
```

---

## Your first five minutes

**1. Send something.**

```bash
heaven get https://api.github.com/users/octocat
heaven post https://httpbin.org/post --json @body.json
```

**2. Tell Heaven where your API lives**, so you can stop typing the host:

```bash
heaven env set dev --base-url http://localhost:3000
heaven get /users            # → http://localhost:3000/users
```

**3. Save a request you'll use again:**

```bash
heaven save list-users get /users -q page=1
heaven run list-users
heaven run list-users -q page=2      # tweak it on the fly
```

**4. Make it check itself:**

```bash
heaven get /health --expect-status 200 --expect-time 300
```

If the check fails, Heaven exits with code `4`, which makes it perfect for CI.

**5. See what changed between environments:**

```bash
heaven env set prod --base-url https://api.example.com
heaven compare list-users --env dev --env prod --ignore updatedAt
```

---

## What's in the box

| You want to...                      | Use                                | Learn more                                                                                   |
| ----------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Send a request                      | `heaven get/post/put/patch/delete` | [Commands](docs/commands.md#sending-requests)                                                |
| Save and re-run requests            | `save`, `run`, `list`, `rm`        | [Commands](docs/commands.md#saved-requests)                                                  |
| Switch between dev / staging / prod | `env`                              | [Environments](docs/environments-and-variables.md)                                           |
| Keep secrets out of files           | `{{$env.NAME}}`                    | [Variables](docs/environments-and-variables.md#variables)                                    |
| Look back at what you sent          | `history`, `replay`                | [Commands](docs/commands.md#history-and-replay)                                              |
| Diff two environments               | `compare`                          | [Commands](docs/commands.md#compare)                                                         |
| Check responses automatically       | `--expect-*`                       | [Testing](docs/testing-and-workflows.md#expectations)                                        |
| Chain requests together             | `flow`                             | [Testing](docs/testing-and-workflows.md#workflows)                                           |
| Load-test an endpoint               | `bench`                            | [Testing](docs/testing-and-workflows.md#benchmarking)                                        |
| Share requests with your team       | `init`                             | [Environments](docs/environments-and-variables.md#project-local-data-sharing-with-your-team) |

The full guide lives in [DOCS.md](DOCS.md).

---

## A few promises Heaven makes

- **Your secrets stay yours.** Tokens and passwords are scrubbed before anything is
  written to history, and Heaven warns you before saving one to a file.
  Details in [Security](DOCS.md#keeping-secrets-safe).
- **Output is script-friendly.** Response data goes to stdout; chatter (timings,
  warnings) goes to stderr. So `heaven get /users | jq .` just works.
- **Exit codes mean something.** `2` is "the server said no", `3` is "couldn't
  reach it", `4` is "your check failed". See [Exit codes](DOCS.md#exit-codes).
- **Big responses won't eat your memory.** Heaven keeps at most 10 MB in memory;
  use `-o file` to stream anything larger straight to disk.

---

## Getting help

```bash
heaven help             # the overview
heaven help flow        # help for one command
heaven get --help
```

Something broken or confusing? Set `HEAVEN_DEBUG=1` to see full error details, and
check [Troubleshooting](DOCS.md#troubleshooting).

Curious how the code is organised? See [docs/architecture.md](docs/architecture.md).
