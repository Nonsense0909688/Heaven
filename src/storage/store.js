// The Store is the one object commands use to touch disk.
// It owns three files:  config.json (environments), requests.json (saved requests), history.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { HeavenError } from '../core/errors.js';
import { readJson, writeJson } from './json-file.js';
import { readHistory, appendHistory } from './history-log.js';

export class Store {
  constructor(dir) {
    this.dir = dir;
    this.files = {
      config: path.join(dir, 'config.json'),
      requests: path.join(dir, 'requests.json'),
      history: path.join(dir, 'history.jsonl'),
    };
  }

  ensureDir() {
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
  }

  #write(file, data) {
    this.ensureDir();
    writeJson(file, data);
  }

  // ── config & environments ──────────────────────────────────────────
  config() {
    const c = readJson(this.files.config, {});
    return { active: c.active ?? null, envs: c.envs ?? {} };
  }
  saveConfig(config) { this.#write(this.files.config, config); }

  getEnv(name) {
    const { envs } = this.config();
    if (envs[name]) return envs[name];
    const known = Object.keys(envs);
    throw new HeavenError(
      `Unknown environment "${name}". ` +
      (known.length ? `Known: ${known.join(', ')}` : 'None defined yet — try: heaven env set dev --base-url http://localhost:3000'),
    );
  }

  // ── saved requests ─────────────────────────────────────────────────
  requests() { return readJson(this.files.requests, {}); }
  saveRequests(requests) { this.#write(this.files.requests, requests); }

  getRequest(name) {
    const all = this.requests();
    if (all[name]) return all[name];
    const known = Object.keys(all);
    throw new HeavenError(
      `No saved request named "${name}". ` + (known.length ? `Saved: ${known.join(', ')}` : 'Nothing saved yet — see: heaven save --help'),
    );
  }

  // ── history ────────────────────────────────────────────────────────
  history() { return readHistory(this.files.history); }

  appendHistory(entry) {
    this.ensureDir();
    return appendHistory(this.files.history, entry);
  }

  getHistory(id) {
    const entry = this.history().find((h) => h.id === Number(id));
    if (!entry) throw new HeavenError(`No history entry #${id}`);
    return entry;
  }

  clearHistory() { fs.rmSync(this.files.history, { force: true }); }
}
