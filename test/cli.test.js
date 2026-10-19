import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

const CLI = resolve(process.cwd(), 'bin/heaven.js');

async function createFixture(t) {
  const server = createServer(async (req, res) => {
    const chunks = [];

    for await (const chunk of req) chunks.push(chunk);

    const body = Buffer.concat(chunks).toString();

    if (req.url?.startsWith('/status/')) {
      const status = Number(req.url.split('/')[2]);
      res.writeHead(status);
      res.end(JSON.stringify({ status }));
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        method: req.method,
        url: req.url,
        body,
        headers: req.headers,
      })
    );
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  t.after(() => new Promise((resolve) => server.close(resolve)));

  return `http://127.0.0.1:${server.address().port}`;
}

function runCLI(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env: {
        ...process.env,
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function parseJSON(result) {
  const output = result.stdout.trim();

  // Find the first complete JSON object.
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < output.length; i++) {
    const char = output[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') depth++;

      if (char === '}') {
        depth--;

        if (depth === 0) {
          return JSON.parse(output.slice(0, i + 1));
        }
      }
    }
  }

  throw new Error(`No valid JSON object found:\n${output}`);
}

test('help displays Heaven usage', async () => {
  const result = await runCLI(['help']);

  assert.equal(result.code, 0);
  assert.match(result.stdout + result.stderr, /heaven/i);
});

test('GET sends an HTTP GET request', async (t) => {
  const base = await createFixture(t);
  const result = await runCLI(['get', `${base}/hello`]);
  assert.equal(result.code, 0, result.stderr);

  const data = parseJSON(result);
  assert.equal(data.method, 'GET');
  assert.equal(data.url, '/hello');
});

test('POST sends a JSON body', async (t) => {
  const base = await createFixture(t);

  const result = await runCLI(['post', `${base}/echo`, '--json', '{"hello":"world"}']);
  assert.equal(result.code, 0, result.stderr);

  const data = parseJSON(result);

  assert.equal(data.method, 'POST');
  assert.deepEqual(JSON.parse(data.body), {
    hello: 'world',
  });
});

test('query parameters are forwarded', async (t) => {
  const base = await createFixture(t);

  const result = await runCLI(['get', `${base}/search`, '-q', 'page=2']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(parseJSON(result).url, /page=2/);
});

test('expected HTTP status passes', async (t) => {
  const base = await createFixture(t);

  const result = await runCLI(['get', `${base}/status/200`, '--expect-status', '200']);

  assert.equal(result.code, 0, result.stderr);
});

test('unexpected HTTP status fails with exit code 4', async (t) => {
  const base = await createFixture(t);

  const result = await runCLI(['get', `${base}/status/200`, '--expect-status', '201']);

  assert.equal(result.code, 4, result.stderr);
});

test('HTTP 404 returns exit code 2', async (t) => {
  const base = await createFixture(t);

  const result = await runCLI(['get', `${base}/status/404`]);

  assert.equal(result.code, 2, result.stderr);
});

test('connection failure returns exit code 3', async () => {
  const result = await runCLI(['get', 'http://127.0.0.1:1/unreachable']);

  assert.equal(result.code, 3, result.stderr);
});
