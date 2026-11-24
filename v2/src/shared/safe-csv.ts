export function safeCsvCell(value: unknown): string {
  let safe = value == null ? '' : String(value);
  if (/^\s*[=+\-@]/u.test(safe) || /^[\t\r\n]/u.test(safe)) safe = `'${safe}`;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function safeCsvLine(values: unknown[]): string {
  return `${values.map(safeCsvCell).join(';')}\r\n`;
}
