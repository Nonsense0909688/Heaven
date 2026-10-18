// Small helpers that turn raw flag strings into structured values.
import { HeavenError } from '../core/errors.js';

/** Last item of a repeatable flag (so `--env a --env b` means b). */
export const last = (list) => (list && list.length ? list[list.length - 1] : undefined);

/** ["a=1", "b=2"] -> { a: "1", b: "2" } */
export function parseKeyValues(list = [], label = 'value') {
  const out = {};
  for (const item of list) {
    const i = item.indexOf('=');
    if (i <= 0) throw new HeavenError(`Invalid ${label} "${item}". Expected key=value`);
    out[item.slice(0, i)] = item.slice(i + 1);
  }
  return out;
}

/** "Name: value" -> ["Name", "value"] */
export function parseHeader(str) {
  const i = str.indexOf(':');
  if (i <= 0) throw new HeavenError(`Invalid header "${str}". Expected "Name: value"`);
  return [str.slice(0, i).trim(), str.slice(i + 1).trim()];
}
