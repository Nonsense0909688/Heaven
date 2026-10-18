// Syntax-highlight pretty-printed JSON for terminals.
export function colorizeJson(text, c) {
  if (!c.on) return text;
  const token = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  return text.replace(token, (m, str, colon, literal, num) => {
    if (str) return colon ? c.blue(str) + colon : c.green(str);   // key : value-string
    if (literal) return c.magenta(literal);
    if (num) return c.yellow(num);
    return m;
  });
}
