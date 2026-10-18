import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, makeHome, hv } from './helpers.js';

let dev; let prod; let H; let home;
before(async () => {
  dev = await startServer({ role: 'admin' });
  prod = await startServer({ role: 'user' });
  H = makeHome();
  home = H.dir;
});
after(async () => { await dev.close(); await prod.close(); H.cleanup(); });

const run = (args, opts = {}) => hv(args, { home, ...opts });

test('GET absolute URL: body → stdout, summary → stderr, exit 0', async () => {
  const r = await run(['get', `${dev.url}/echo`, '-q', 'a=1', '-H', 'X-T: yes']);
  assert.equal(r.code, 0);
  const body = JSON.parse(r.stdout);
  assert.equal(body.query.a, '1');
  assert.equal(body.headers['x-t'], 'yes');
  assert.match(r.stderr, /200 OK/);
});

test('--output json gives a clean machine-readable envelope on stdout', async () => {
  const r = await run(['get', `${dev.url}/users/3`, '--output', 'json']);
  const env = JSON.parse(r.stdout);
  assert.equal(env.status, 200);
  assert.equal(env.body.id, 3);
  assert.equal(typeof env.timeMs, 'number');
});

test('POST --json sets content-type and body; --data works; --form multipart with file', async () => {
  let r = await run(['post', `${dev.url}/echo`, '--json', '{"name":"Anish"}']);
  let b = JSON.parse(r.stdout);
  assert.equal(b.headers['content-type'], 'application/json');
  assert.equal(b.body, '{"name":"Anish"}');

  r = await run(['put', `${dev.url}/echo`, '-d', 'a=1&b=2']);
  b = JSON.parse(r.stdout);
  assert.equal(b.method, 'PUT');
  assert.equal(b.headers['content-type'], 'application/x-www-form-urlencoded');

  const f = path.join(home, 'f.txt');
  fs.writeFileSync(f, 'filedata');
  r = await run(['post', `${dev.url}/upload`, '-F', 'x=1', '-F', `file=@${f}`]);
  b = JSON.parse(r.stdout);
  assert.equal(b.contentType, 'multipart/form-data');
  assert.equal(b.hasFile, true);

  r = await run(['post', `${dev.url}/upload`, '--upload', f]);
  b = JSON.parse(r.stdout);
  assert.equal(b.contentType, 'application/octet-stream');
  assert.equal(b.bytes, 8);
});

test('--json @file reads the body from disk (PowerShell-safe)', async () => {
  const f = path.join(home, 'body.json');
  fs.writeFileSync(f, '{"from":"file"}');
  const r = await run(['post', `${dev.url}/echo`, '--json', `@${f}`]);
  assert.equal(JSON.parse(r.stdout).body, '{"from":"file"}');
});

test('exit codes: 404 → 2, refused → 3, timeout → 3, bad JSON → 1, assertion → 4', async () => {
  assert.equal((await run(['get', `${dev.url}/status/404`])).code, 2);
  assert.equal((await run(['get', `${dev.url}/status/404`, '--no-fail'])).code, 0);
  assert.equal((await run(['get', `${dev.url}/status/404`, '--expect-status', '404'])).code, 0);
  assert.equal((await run(['get', 'http://127.0.0.1:1/'])).code, 3);
  const slow = await run(['get', `${dev.url}/slow?ms=1500`, '-t', '200']);
  assert.equal(slow.code, 3);
  assert.match(slow.stderr, /timed out/);
  assert.equal((await run(['post', `${dev.url}/echo`, '--json', '{bad'])).code, 1);
  assert.equal((await run(['get', `${dev.url}/users/1`, '--expect-status', '201'])).code, 4);
  assert.equal((await run(['get', `${dev.url}/users/1`, '--expect-json', 'role=admin', '--expect-time', '5000'])).code, 0);
  assert.equal((await run(['get', `${dev.url}/users/1`, '--expect-json', 'role=nobody'])).code, 4);
});

test('redirects: followed by default, --no-follow shows the 3xx', async () => {
  const followed = await run(['get', `${dev.url}/redirect`]);
  assert.equal(JSON.parse(followed.stdout).path, '/echo');
  const manual = await run(['get', `${dev.url}/redirect`, '--no-follow', '-i', '--no-fail']);
  assert.match(manual.stdout, /^302/);
  assert.match(manual.stdout, /location: \/echo/);
});

test('streaming: -o saves a large body to disk without buffering; truncation is announced', async () => {
  const out = path.join(home, 'big.bin');
  const r = await run(['get', `${dev.url}/big?mb=20`, '-o', out]);
  assert.equal(r.code, 0);
  assert.equal(fs.statSync(out).size, 20 * 1024 * 1024);
  assert.match(r.stderr, /saved 20\.0 MB/);

  const t = await run(['get', `${dev.url}/bigtext`, '--max-buffer', '1']);
  assert.equal(t.stdout.length, 1024 * 1024);
  assert.match(t.stderr, /truncated/);
});

test('binary bodies are not dumped to the terminal', async () => {
  const r = await run(['get', `${dev.url}/binary`]);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /binary body/);
});

test('environments: relative URL needs a base; env set/use/list/show; secrets masked', async () => {
  let r = await run(['get', '/users/1']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /no base URL/);

  await run(['env', 'set', 'dev', '--base-url', dev.url, '-v', 'team=core', '-H', 'X-Team: {{team}}']);
  r = await run(['env', 'set', 'prod', '--base-url', prod.url, '-v', 'apiKey=topsecret']);
  assert.match(r.stderr, /looks like a secret/);
  await run(['env', 'use', 'dev']);

  r = await run(['get', '/echo']);
  assert.equal(JSON.parse(r.stdout).headers['x-team'], 'core');

  r = await run(['env', 'list']);
  assert.match(r.stdout, /\* +dev/);
  r = await run(['env', 'show', 'prod']);
  assert.ok(!r.stdout.includes('topsecret'));
  assert.match(r.stdout, /\*{4,}/);
  r = await run(['get', '/users/9', '--env', 'prod']);
  assert.equal(JSON.parse(r.stdout).role, 'user');
});

test('saved requests: save, list, run with variables, overrides, rm', async () => {
  let r = await run(['save', 'get-user', 'get', '/users/{{id}}']);
  assert.equal(r.code, 0);
  r = await run(['run', 'get-user']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /\{\{id\}\}/);
  r = await run(['run', 'get-user', '--var', 'id=42']);
  assert.equal(JSON.parse(r.stdout).id, 42);

  r = await run(['list']);
  assert.match(r.stdout, /get-user\s+GET\s+\/users\/\{\{id\}\}/);

  await run(['save', 'login', 'post', '/login', '--json', '{"user":"a","password":"{{pw}}"}']);
  r = await run(['run', 'login', '--var', 'pw=pw', '--output', 'json']);
  assert.equal(JSON.parse(r.stdout).body.access_token, 'tok123');

  r = await run(['rm', 'login']);
  assert.equal(r.code, 0);
  assert.equal((await run(['run', 'login'])).code, 1);
});

test('save warns about literal secrets; env-referenced secrets are not stored', async () => {
  let r = await run(['save', 'leaky', 'get', '/me', '--bearer', 'tok123']);
  assert.match(r.stderr, /literal secrets/);
  r = await run(['save', 'safe', 'get', '/me', '--bearer', '{{$env.HV_TOKEN}}']);
  assert.ok(!/warning/.test(r.stderr));
  r = await run(['run', 'safe'], { env: { HV_TOKEN: 'tok123' } });
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.stdout).user, 'anish');
  assert.equal((await run(['run', 'safe'])).code, 1); // env var missing → clear error, not a silent empty token
});

test('history: records requests, redacts secrets, replay works with variables, refuses redacted', async () => {
  await run(['history', 'clear']);
  await run(['get', '/me', '--bearer', 'tok123', '-q', 'token=abc&x']);   // literal secret
  await run(['get', '/me', '--bearer', '{{t}}', '--var', 't=tok123']);     // placeholder
  const raw = fs.readFileSync(path.join(home, 'history.jsonl'), 'utf8');
  assert.ok(!raw.includes('tok123') && !raw.includes('token=abc'), 'secrets must never reach history');

  let r = await run(['history', '--output', 'json']);
  const h = JSON.parse(r.stdout);
  assert.equal(h.length, 2);
  assert.ok(h[0].status && h[0].timeMs !== undefined);

  r = await run(['replay', String(h[0].id)]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /redacted/);
  assert.match(r.stderr, /query token/);
  assert.match(r.stderr, /--bearer/);
  r = await run(['replay', String(h[0].id), '--bearer', 'tok123', '-q', 'token=abc']);
  assert.equal(r.code, 0, r.stderr);

  r = await run(['replay', String(h[1].id), '--var', 't=tok123']);
  assert.equal(JSON.parse(r.stdout).user, 'anish');

  r = await run(['history', '--search', '/me', '--limit', '1']);
  assert.match(r.stdout, /\/me/);
  r = await run(['history', 'show', String(h[1].id)]);
  assert.match(r.stdout, /auth: bearer \{\{t\}\}/);
  assert.equal((await run(['get', '/echo', '--no-history'])).stderr.includes('history #'), false);
});

test('compare: finds differences between environments, honours --ignore, exit codes', async () => {
  await run(['save', 'who', 'get', '/users/5']);
  let r = await run(['compare', 'who', '--env', 'dev', '--env', 'prod', '--ignore', 'updatedAt']);
  assert.equal(r.code, 5);
  assert.match(r.stdout, /role\s+"admin" → "user"/);
  assert.ok(!r.stdout.includes('updatedAt'));

  r = await run(['compare', 'who', '--env', 'dev', '--env', 'prod', '--ignore', 'updatedAt,role']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /identical/);

  r = await run(['compare', 'get', '/users/5', '--env', 'dev', '--env', 'prod', '--output', 'json', '--ignore', 'updatedAt']);
  const j = JSON.parse(r.stdout);
  assert.equal(j.identical, false);
  assert.equal(j.body.diffs[0].path, 'role');

  r = await run(['compare', 'who', '--env', 'dev']);
  assert.equal(r.code, 1);
});

test('flow: chains login → extract token → authenticated call; stops on failure', async () => {
  const good = {
    name: 'login flow',
    vars: { pw: 'pw' },
    steps: [
      { name: 'login', method: 'POST', url: '/login', json: { user: 'a', password: '{{pw}}' }, expect: { status: 200 }, extract: { token: 'body.access_token', uid: 'body.user.id' } },
      { name: 'me', method: 'GET', url: '/me', bearer: '{{token}}', expect: { status: 200, json: { user: 'anish' }, maxTime: 5000 } },
      { name: 'echo', use: 'who' },
    ],
  };
  const f = path.join(home, 'flow.json');
  fs.writeFileSync(f, JSON.stringify(good));
  let r = await run(['flow', f]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PASSED\s+3\/3/);
  assert.match(r.stdout, /→ token, uid/);

  const bad = { steps: [{ name: 'login', method: 'POST', url: '/login', json: { password: 'wrong' } }, { name: 'never', method: 'GET', url: '/me' }] };
  fs.writeFileSync(f, JSON.stringify(bad));
  r = await run(['flow', f, '--output', 'json']);
  assert.equal(r.code, 2);
  const rep = JSON.parse(r.stdout);
  assert.equal(rep.ok, false);
  assert.equal(rep.skipped, 1);

  fs.writeFileSync(f, JSON.stringify({ steps: [{ name: 'a', method: 'GET', url: '/users/1', expect: { json: { role: 'nope' } } }] }));
  assert.equal((await run(['flow', f])).code, 4);

  fs.writeFileSync(f, JSON.stringify({ steps: [{ name: 'a', method: 'GET', url: '/users/1', extract: { x: 'body.nothere' } }] }));
  assert.equal((await run(['flow', f])).code, 4);
});

test('bench: percentiles, statuses, error rate, p95 threshold', async () => {
  let r = await run(['bench', 'get', '/users/1', '-n', '40', '-c', '8', '--output', 'json']);
  assert.equal(r.code, 0);
  const b = JSON.parse(r.stdout);
  assert.equal(b.requests, 40);
  assert.equal(b.statuses['200'], 40);
  assert.equal(b.errorRate, 0);
  assert.ok(b.latencyMs.p50 <= b.latencyMs.p95 && b.latencyMs.p95 <= b.latencyMs.max);

  r = await run(['bench', 'get', '/status/500', '-n', '5', '-c', '2']);
  assert.equal(r.code, 2);
  assert.match(r.stdout, /errors\s+5 \(100%\)/);

  r = await run(['bench', 'get', '/slow?ms=50', '-n', '4', '-c', '2', '--max-p95', '1']);
  assert.equal(r.code, 4);
});

test('init creates a project-local .heaven that is discovered from subdirectories', async () => {
  const proj = fs.mkdtempSync(path.join(home, 'proj-'));
  const sub = path.join(proj, 'a', 'b');
  fs.mkdirSync(sub, { recursive: true });
  const env = { HEAVEN_HOME: '' };
  let r = await hv(['init'], { home: undefined, cwd: proj, env });
  assert.equal(r.code, 0);
  assert.ok(fs.existsSync(path.join(proj, '.heaven', 'requests.json')));
  assert.match(fs.readFileSync(path.join(proj, '.heaven', '.gitignore'), 'utf8'), /history\.jsonl/);
  r = await hv(['save', 'x', 'get', 'http://127.0.0.1:1/'], { home: undefined, cwd: sub, env });
  assert.equal(r.code, 0);
  assert.ok('x' in JSON.parse(fs.readFileSync(path.join(proj, '.heaven', 'requests.json'), 'utf8')));
});

test('help, version and unknown command', async () => {
  assert.match((await run(['help'])).stdout, /terminal API workshop/);
  assert.match((await run(['help', 'compare'])).stdout, /--ignore/);
  assert.match((await run(['--version'])).stdout, /^\d+\.\d+\.\d+/);
  const r = await run(['frobnicate']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Unknown command/);
});

test('--silent still explains a failed expectation', async () => {
  const r = await run(['get', `${dev.url}/users/1`, '--expect-status', '201', '-s']);
  assert.equal(r.code, 4);
  assert.match(r.stderr, /✗ status is 201 — got 200/);
  assert.ok(!/200 OK/.test(r.stderr));
});
