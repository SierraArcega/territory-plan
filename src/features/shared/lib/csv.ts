// Shared CSV helpers used by every export surface (reports, copilot, activities,
// and the dashboard deal modals) plus the leads bulk-upload import. One
// escaping/quoting implementation so a column with a comma/quote/newline can't
// break one feature's export and not another's.

function escapeCell(v: unknown): string {
  if (v == null) return "";
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(
  columns: string[],
  rows: Array<Record<string, unknown>>,
): string {
  const header = columns.map(escapeCell).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCell(r[c])).join(",")).join("\n");
  return body ? `${header}\n${body}\n` : `${header}\n`;
}

export interface ParsedCsv {
  /** Header row, trimmed (BOM stripped from the first cell). */
  headers: string[];
  /** One object per data row, keyed by header. Missing cells are "". */
  rows: Array<Record<string, string>>;
}

/**
 * RFC-4180-style CSV parse (the read-side twin of rowsToCsv): quoted fields,
 * escaped quotes (""), commas and newlines inside quotes, CRLF/CR/LF line
 * endings. The first record is the header row; fully-empty records are
 * skipped; extra cells beyond the header are dropped.
 */
export function parseCsv(text: string): ParsedCsv {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  const endField = () => {
    record.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
  };

  // Strip a leading UTF-8 BOM.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++; // escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      endField();
    } else if (ch === "\n") {
      endRecord();
    } else if (ch === "\r") {
      endRecord();
      if (src[i + 1] === "\n") i++; // CRLF
    } else {
      field += ch;
    }
  }
  // Final record (no trailing newline).
  if (field.length > 0 || record.length > 0) endRecord();

  const nonEmpty = records.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim();
    });
    return row;
  });
  return { headers, rows };
}

export function slugifyForFilename(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "report"
  );
}

export function downloadCsv(filename: string, csv: string): void {
  // jsdom / unsupported environments have no object-URL support — no-op so tests
  // that trigger an export don't throw.
  if (typeof URL?.createObjectURL !== "function") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
