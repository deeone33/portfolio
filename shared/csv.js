// Generic CSV export — takes an array of flat objects and a list of
// columns (so column order/inclusion is explicit, not "whatever keys
// happen to exist on the first row"), and triggers a browser download.

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Quote any field containing a comma, quote, or newline; double up internal quotes.
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function arrayToCsv(rows, columns) {
  const header = columns.map(c => csvEscape(c.label)).join(',');
  const body = rows.map(row =>
    columns.map(c => csvEscape(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(',')
  ).join('\n');
  return header + '\n' + body;
}

export function downloadCsv(filename, csvString) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
