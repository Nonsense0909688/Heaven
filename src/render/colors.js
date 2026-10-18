// ANSI colours, automatically disabled when output isn't a terminal or NO_COLOR is set.
export function makeColors(stream = process.stderr) {
  const on = !process.env.NO_COLOR && (process.env.FORCE_COLOR ? true : stream.isTTY);
  const wrap = (open, close) => (s) => (on ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));
  return {
    on,
    bold: wrap(1, 22), dim: wrap(2, 22), red: wrap(31, 39), green: wrap(32, 39),
    yellow: wrap(33, 39), blue: wrap(34, 39), magenta: wrap(35, 39), cyan: wrap(36, 39), gray: wrap(90, 39),
  };
}

/** Colour for an HTTP status code: 5xx red, 4xx yellow, 3xx cyan, else green. */
export function statusColor(c, status) {
  if (status >= 500) return c.red;
  if (status >= 400) return c.yellow;
  if (status >= 300) return c.cyan;
  return c.green;
}
