import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';

const BIN = new URL('../bin/heaven.js', import.meta.url).pathname;

/** A tiny API server. `role` lets two instances act as "dev" and "prod". */
export function startServer({ role = 'admin' } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const raw = Buffer.concat(chunks);
    const send = (status, obj, headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', ...headers });
      res.end(JSON.stringify(obj));
    };
    const p = url.pathname;

    if (p === '/echo') {
      return send(200, {
        method: req.method, path: p,
        query: Object.fromEntries(url.searchParams), headers: req.headers, body: raw.toString('utf8'),
      });
    }
    if (p.startsWith('/users/')) {
      return send(200, { id: Number(p.split('/')[2]), name: 'Anish', role, active: true, updatedAt: Date.now() });
    }
    if (p === '/login' && req.method === 'POST') {
      const b = JSON.parse(raw.toString() || '{}');
      return b.password === 'pw' ? send(200, { access_token: 'tok123', user: { id: 7 } }) : send(401, { error: 'bad creds' });
    }
    if (p === '/me') {
      return req.headers.authorization === 'Bearer tok123' ? send(200, { user: 'anish' }) : send(401, { error: 'no' });
    }
    if (p.startsWith('/status/')) return send(Number(p.split('/')[2]), { status: Number(p.split('/')[2]) });
    if (p === '/slow') { return setTimeout(() => send(200, { slow: true }), Number(url.searchParams.get('ms') || 500)); }
    if (p === '/big') {
      const mb = Number(url.searchParams.get('mb') || 1);
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      const block = Buffer.alloc(1024 * 1024, 97);
      let i = 0;
      const write = () => {
        while (i < mb) { i++; if (!res.write(block)) return res.once('drain', write); }
        res.end();
      };
      return write();
    }
    if (p === '/bigtext') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('a'.repeat(3 * 1024 * 1024));
    }
    if (p === '/redirect') { res.writeHead(302, { location: '/echo' }); return res.end(); }
    if (p === '/upload') {
      return send(200, { bytes: raw.length, contentType: req.headers['content-type'].split(';')[0], hasFile: raw.includes('filedata') });
    }
    if (p === '/binary') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(Buffer.from([137, 80, 78, 71, 0, 1, 2, 3])); }
    if (p === '/text') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('hello world'); }
    send(404, { error: 'not found' });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ url: `http://127.0.0.1:${port}`, port, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) });
    });
  });
}

export function makeHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'heaven-test-'));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/** Run the real CLI as a subprocess. Returns { code, stdout, stderr }. */
export function hv(args, { home, env = {}, cwd } = {}) {
  return new Promise((resolve) => {
    execFile(process.execPath, [BIN, ...args], {
      cwd, env: { ...process.env, NO_COLOR: '1', HEAVEN_HOME: home, ...env }, maxBuffer: 64 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      resolve({ code: error ? error.code : 0, stdout, stderr });
    });
  });
}
