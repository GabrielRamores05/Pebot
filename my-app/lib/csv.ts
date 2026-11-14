/**
 * CSV export (spec 022). Excel-friendly: UTF-8 with a byte-order mark so ₱ and
 * ñ show correctly, CRLF line ends, and cells that start with = + - @ are
 * prefixed with ' so a spreadsheet never runs them as formulas.
 */

export type CsvColumn<T> = { label: string; value: (row: T) => string | number | boolean | null | undefined | Date };

function cell(v: unknown): string {
  if (v == null) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => cell(c.value(r))).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Safe file name like "orders-2026-11-14.csv". */
export function csvFileName(base: string, date = new Date()): string {
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export'}-${d}.csv`;
}

/** Browser only: save the CSV as a download. */
export function downloadCsv<T>(base: string, rows: T[], columns: CsvColumn<T>[]): void {
  const blob = new Blob([toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = csvFileName(base);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
