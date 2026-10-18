import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/args.js';
import { Resolver } from '../src/vars.js';
import { getPath, parsePath } from '../src/jsonpath.js';
import { parseJsonExpect, parseStatusExpect, evaluate } from '../src/assert.js';
import { diffJson, isIgnored } from '../src/compare.js';
import { redactTemplate, redactHeaders, findLiteralSecrets } from '../src/redact.js';
import { prepare, templateFromFlags, mergeTemplate } from '../src/request.js';
import { percentile } from '../src/bench.js';

test('args: repeated flags, shorts, = syntax, clusters', () => {
  const { _, flags } = parseArgs(['post', '/x', '-H', 'A: 1', '-HB: 2', '--query=a=b', '-ik', '--json', '{"a":1}']);
  assert.deepEqual(_, ['post', '/x']);
  assert.deepEqual(flags.header, ['A: 1', 'B: 2']);
  assert.deepEqual(flags.query, ['a=b']);
  assert.equal(flags.include, true);
  assert.equal(flags.insecure, true);
  assert.equal(flags.json, '{"a":1}');
});

test('args: unknown option and missing value are errors', () => {
  assert.throws(() => parseArgs(['--nope']), /Unknown option/);
  assert.throws(() => parseArgs(['--json']), /requires a value/);
});

test('args: -- ends option parsing', () => {
  assert.deepEqual(parseArgs(['get', '--', '--weird']).flags, {});
  assert.deepEqual(parseArgs(['get', '--', '--weird'])._, ['get', '--weird']);
});

test('vars: resolves nested, $env, and reports all missing at once', () => {
  process.env.HV_TEST = 'from-env';
  const r = new Resolver({ a: '{{b}}-x', b: 'B' });
  assert.equal(r.str('{{a}} {{ $env.HV_TEST }}'), 'B-x from-env');
  r.str('{{nope}} {{nada}}');
  assert.throws(() => r.assertComplete(), /\{\{nope\}\}, \{\{nada\}\}/);
});

test('jsonpath', () => {
  assert.deepEqual(parsePath('$.a.b[2]["c d"]'), ['a', 'b', 2, 'c d']);
  const o = { a: { b: [{ c: 1 }] }, n: null };
  assert.deepEqual(getPath(o, 'a.b[0].c'), { found: true, value: 1 });
  assert.deepEqual(getPath(o, 'n'), { found: true, value: null });
  assert.equal(getPath(o, 'a.x.y').found, false);
});

test('assert: parsing and evaluation', () => {
  assert.deepEqual(parseJsonExpect('data.id=5'), { path: 'data.id', equals: 5 });
  assert.deepEqual(parseJsonExpect('name~^An'), { path: 'name', matches: '^An' });
  assert.deepEqual(parseJsonExpect('user.email'), { path: 'user.email', exists: true });
  assert.deepEqual(parseStatusExpect('200,201'), [200, 201]);
  assert.throws(() => parseStatusExpect('abc'));
  const res = { status: 201, timeMs: 120, headers: { 'x-a': '1' }, text: '{"id":5,"tags":["a"]}', json: { id: 5, tags: ['a'] } };
  const ok = evaluate({ status: '2xx', maxTime: 200, json: { id: 5 }, contains: 'tags', headers: { 'X-A': '1' } }, res);
  assert.equal(ok.passed, true);
  const bad = evaluate({ status: 200, maxTime: 50, json: [{ path: 'id', gt: 10 }, { path: 'missing', exists: true }] }, res);
  assert.equal(bad.passed, false);
  assert.equal(bad.checks.filter((c) => !c.ok).length, 4);
});

test('diff: changed / added / removed / type / arrays / ignore', () => {
  const a = { role: 'admin', n: 1, gone: true, list: [1, 2], t: 'x', ts: 1 };
  const b = { role: 'user', n: 1, extra: 1, list: [1, 3, 4], t: 5, ts: 2 };
  const d = diffJson(a, b, ['ts']);
  const by = Object.fromEntries(d.map((x) => [x.path, x.type]));
  assert.deepEqual(by, { role: 'changed', gone: 'removed', extra: 'added', 'list[1]': 'changed', 'list[2]': 'added', t: 'type' });
  assert.equal(diffJson({ a: [{ id: 1 }] }, { a: [{ id: 2 }] }, ['a[*].id']).length, 0);
  assert.equal(isIgnored('x.updatedAt', ['updatedAt']), true);
  assert.equal(isIgnored('x.updatedAt', ['updated']), false);
});

test('redact: literal secrets are hidden, placeholders kept', () => {
  const t = {
    method: 'POST', url: 'http://x/y?token=abc&page=2&key={{k}}',
    headers: { Authorization: 'Bearer secret', 'X-Api-Key': '{{key}}', Accept: 'a' },
    body: { type: 'json', value: '{"user":"a","password":"hunter2","nested":{"api_key":"zzz"}}' },
    auth: { type: 'bearer', token: 'abc' },
  };
  const r = redactTemplate(t);
  const s = JSON.stringify(r);
  assert.ok(!s.includes('secret') && !s.includes('hunter2') && !s.includes('zzz') && !s.includes('token=abc'));
  assert.equal(r.headers['X-Api-Key'], '{{key}}');
  assert.equal(r.headers.Authorization, 'Bearer [REDACTED]');
  assert.ok(r.url.includes('page=2') && r.url.includes('key={{k}}'));
  assert.ok(findLiteralSecrets(t).length > 0);
  assert.equal(redactHeaders({ Cookie: '{{c}}' }).Cookie, '{{c}}');
});

test('prepare: base URL, query, auth, env headers, json defaults', () => {
  const env = { headers: { 'X-Env': '{{team}}' } };
  const vars = { baseUrl: 'http://h:1/', team: 'core', tok: 'T' };
  const t = templateFromFlags({ query: ['a=1', 'b={{tok}}'], bearer: '{{tok}}', json: '{"x":"{{tok}}"}' }, 'post', '/users');
  const r = prepare(t, { env, vars });
  assert.equal(r.url, 'http://h:1/users?a=1&b=T');
  assert.equal(r.headers.Authorization, 'Bearer T');
  assert.equal(r.headers['X-Env'], 'core');
  assert.equal(r.headers['Content-Type'], 'application/json');
  assert.equal(r.body.value, '{"x":"T"}');
});

test('prepare: absolute URLs ignore base; bare localhost gets http; relative without base errors', () => {
  assert.equal(prepare({ method: 'GET', url: 'https://a.b/c' }, { vars: { baseUrl: 'http://zzz' } }).url, 'https://a.b/c');
  assert.equal(prepare({ method: 'GET', url: 'localhost:3000/x' }, {}).url, 'http://localhost:3000/x');
  assert.throws(() => prepare({ method: 'GET', url: '/users' }, {}), /no base URL/);
});

test('prepare: invalid JSON body and missing vars give clear errors', () => {
  assert.throws(() => prepare({ method: 'POST', url: 'http://a', body: { type: 'json', value: '{oops' } }, {}), /not valid JSON/);
  assert.throws(() => prepare({ method: 'GET', url: 'http://a/{{id}}' }, {}), /\{\{id\}\}/);
});

test('templateFromFlags rejects multiple body types; mergeTemplate overlays headers case-insensitively', () => {
  assert.throws(() => templateFromFlags({ json: '{}', data: 'x' }, 'post', '/a'), /one body option/);
  const m = mergeTemplate({ method: 'GET', url: '/a', headers: { accept: 'x', A: '1' } }, { headers: { Accept: 'y' }, query: ['q=1'] });
  assert.deepEqual(m.headers, { A: '1', Accept: 'y' });
  assert.deepEqual(m.query, ['q=1']);
});

test('percentile (nearest-rank)', () => {
  const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(percentile(s, 50), 5);
  assert.equal(percentile(s, 95), 10);
  assert.equal(percentile([], 50), null);
});
