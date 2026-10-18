// Plain-text table with aligned columns (ANSI-colour aware).
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

export function printTable(rows, header, write, c) {
  const all = header ? [header, ...rows] : rows;

  const widths = [];                                  // widest visible cell in each column
  for (const row of all) {
    row.forEach((cell, i) => { widths[i] = Math.max(widths[i] || 0, stripAnsi(String(cell)).length); });
  }

  const formatRow = (row) => row.map((cell, i) => {
    const s = String(cell);
    const isLast = i === row.length - 1;              // no trailing padding on the last column
    return isLast ? s : s + ' '.repeat(widths[i] - stripAnsi(s).length);
  }).join('  ');

  if (header) write(c.dim(formatRow(header)) + '\n');
  for (const row of rows) write(formatRow(row) + '\n');
}
