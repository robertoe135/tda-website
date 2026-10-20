/**
 * CSV in and out, for files marketing opens in Excel or Google Sheets.
 */

/** RFC 4180 CSV (or another separator, such as a tab): quoted fields, doubled quotes, commas and line breaks inside quotes, CRLF. */
export function parseCsv(text: string, sep = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^﻿/, '') // Excel's byte-order mark
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === sep) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim()))
}

/** A CSV with the given columns, in that order; cells with commas, quotes or line breaks are quoted. */
export const toCsv = (rows: Record<string, unknown>[], columns: string[]): string => {
  const cell = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') + '\n'
}
