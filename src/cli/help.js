// All help text. GENERAL is `heaven help`; COMMANDS[name] is `heaven help <name>`.
export const GENERAL = `
heaven — your terminal API workshop            (alias: hv)

SEND
  heaven get /users                       relative URLs use the active environment
  heaven post /users --json '{"name":"Anish"}'
  heaven get https://api.github.com/users/octocat
  heaven get /users -q page=2 -H "X-Debug: 1" --bearer {{token}} -i

REMEMBER
  heaven save create-user post /users --json @user.json
  heaven save --last ...                  (see: heaven help save)
  heaven run create-user                  re-send it (add --env prod, --var id=7 …)
  heaven list · heaven rm NAME

ENVIRONMENTS
  heaven env set staging --base-url https://staging.example.com --var token='{{$env.STAGING_TOKEN}}'
  heaven env use staging · heaven env list · heaven env show

COMPARE
  heaven compare get-user --env dev --env prod --ignore updatedAt,id

HISTORY
  heaven history · heaven history show 12 · heaven replay 12

WORKFLOWS & TESTS
  heaven flow checkout.json               chain requests, extract values, assert
  heaven get /health --expect-status 200 --expect-time 300
  heaven bench get-users -n 200 -c 20

OTHER
  heaven init                             create a project-local .heaven/ (git-friendly)
  heaven help <command>

COMMON OPTIONS
  -H, --header "K: v"     -q, --query k=v        -e, --env NAME       -v, --var k=v
  --json BODY|@file       -d, --data BODY|@file  -F, --form k=v|k=@file   --upload FILE
  --bearer TOKEN          --basic user:pass      -t, --timeout MS     --no-follow
  -i, --include           -V, --verbose          -s, --silent         -k, --insecure
  -o, --output-file FILE  --output json          --raw / --pretty     --stream
  --expect-status 200|2xx  --expect-json path=value  --expect-contains TEXT  --expect-time MS
  --no-history            --no-fail              --no-color

EXIT CODES
  0 ok · 1 usage/config error · 2 HTTP 4xx/5xx · 3 network/timeout/TLS · 4 assertion failed · 5 compare found differences
`;

export const COMMANDS = {
  save: `
heaven save NAME [METHOD] URL [request options]
heaven save NAME --last [overrides]

Stores a request template under NAME in requests.json. {{placeholders}} are kept
unresolved, so the same request works in any environment.
  heaven save login post /login --json '{"user":"anish","password":"{{$env.PASS}}"}'
Literal secrets trigger a warning; use {{$env.NAME}} or {{variables}} instead.
--last re-saves the most recent history entry (only possible when it held no secrets).
`,
  run: `
heaven run NAME [overrides]

Sends a saved request. Any request option overrides the saved one:
  heaven run get-user --env prod --var id=42 -H "X-Debug: 1" -i
`,
  env: `
heaven env set NAME [--base-url URL] [-v key=value]... [-H "Header: value"]...
heaven env use NAME        make NAME the active environment
heaven env list | show [NAME] | rm NAME

Variables with an empty value (-v key=) are removed. Values may reference your shell
environment so secrets never touch disk:   -v token='{{$env.MY_TOKEN}}'
`,
  compare: `
heaven compare NAME --env A --env B [--ignore a,b.c,items[*].id] [--headers]
heaven compare get /users --env dev --env prod

Sends the same request to both environments and reports differences in status, JSON
body (field by field) and optionally headers. Response time is shown but never counts
as a difference. --ignore takes key names (any depth), exact paths, or wildcards.
Exit code 5 when differences are found, 0 when identical.
`,
  history: `
heaven history [--limit 20] [--search TEXT]
heaven history show ID
heaven history clear
heaven replay ID [overrides]

History stores request templates with secrets redacted, plus response metadata (status,
time, size) — never response bodies. Replaying an entry that contained redacted secrets
needs them supplied again (-H / --bearer) or expressed as {{variables}}.
`,
  flow: `
heaven flow FILE.json [--env NAME] [--var k=v] [--output json]

{
  "name": "login then fetch profile",
  "vars": { "user": "anish" },
  "steps": [
    { "name": "login", "method": "POST", "url": "/login",
      "json": { "user": "{{user}}", "password": "{{$env.PASS}}" },
      "expect": { "status": 200 },
      "extract": { "token": "body.access_token" } },
    { "name": "me", "method": "GET", "url": "/me", "bearer": "{{token}}",
      "expect": { "status": 200, "json": { "user": "anish" }, "maxTime": 500 } }
  ]
}

A step is either inline (method/url/...) or "use": "saved-request-name".
extract: body.a.b[0] · headers.location · status.   expect: status (200 | "2xx" | [200,201]),
maxTime, contains, headers, json (map of path→value or list of {path, equals|exists|gt|lt|matches|type}).
Stops at the first failing step (set "continueOnError": true to keep going).
`,
  bench: `
heaven bench NAME|URL [-n 100] [-c 10] [--max-p95 MS] [--output json]
heaven bench get /health -n 500 -c 25

Sends -n requests with -c in flight; bodies are read and discarded. Reports latency
percentiles, throughput, status histogram and error rate. Exit 2 if any request failed,
4 if --max-p95 is exceeded.
`,
};
