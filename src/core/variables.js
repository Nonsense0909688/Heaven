import { HeavenError } from './errors.js';

const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;
const MAX_DEPTH = 5;

/**
 * Resolves {{name}} placeholders.
 *   {{token}}        -> variable from CLI / flow / environment
 *   {{$env.API_KEY}} -> process environment variable (keeps secrets out of files)
 * Values may themselves contain placeholders (resolved up to 5 levels deep).
 * Unknown names are collected so we can report all of them at once.
 */
export class Resolver {
  constructor(vars = {}) {
    this.vars = vars;
    this.missing = new Set();
  }

  /** Value for one placeholder name, or undefined if unknown. */
  lookup(name) {
    if (name.startsWith('$env.')) return process.env[name.slice(5)];
    const v = this.vars[name];
    return v === undefined || v === null ? undefined : String(v);
  }

  /** Replace every {{placeholder}} in a string. Unknown ones are left as-is and recorded. */
  str(input, depth = 0) {
    if (typeof input !== 'string' || !input.includes('{{')) return input;
    return input.replace(PLACEHOLDER, (whole, name) => {
      const v = this.lookup(name);
      if (v === undefined) { this.missing.add(name); return whole; }
      return depth < MAX_DEPTH && v.includes('{{') ? this.str(v, depth + 1) : v;
    });
  }

  /** Throw one friendly error listing every unresolved placeholder. */
  assertComplete() {
    if (!this.missing.size) return;
    const names = [...this.missing].map((n) => `{{${n}}}`).join(', ');
    throw new HeavenError(
      `Unresolved variable${this.missing.size > 1 ? 's' : ''}: ${names}\n` +
      `  Define with --var name=value, or: heaven env set <env> --var name=value`,
    );
  }
}

export const hasPlaceholder = (s) => typeof s === 'string' && s.includes('{{');
