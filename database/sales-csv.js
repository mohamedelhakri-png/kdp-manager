import { validateSale } from "./sales-validation.js";

// Accepts a deliberately documented normalized CSV format, not arbitrary KDP exports.
export function parseSalesCsv(csv, books) {
  if (typeof csv !== "string" || Buffer.byteLength(csv, "utf8") > 262144) return { error: "CSV exceeds 256 KB" };
  const rows = [];
  let row = [], field = "", quoted = false, closed = false;
  const source = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i+1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
    } else if (ch === '"' && !field && !closed) quoted = true;
    else if (ch === ",") { row.push(field); field = ""; closed = false; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i+1] === "\n") i++;
      row.push(field); if (row.some(v => v.trim() !== "")) rows.push(row);
      row = []; field = ""; closed = false;
    } else if (closed || ch === '"') return { error: "Invalid CSV quoting" };
    else field += ch;
  }
  if (quoted) return { error: "Unterminated CSV quoted field" };
  row.push(field);
  if (row.some(v => v.trim() !== "")) rows.push(row);
  if (rows.length < 2 || rows.length > 501) return { error: "CSV must contain 1–500 sales rows" };
  const expected = ["asin","sale_date","units","royalties","currency"];
  if (rows[0].map(v=>v.trim().toLowerCase()).join(",") !== expected.join(",")) return { error: "Expected columns: asin,sale_date,units,royalties,currency" };
  const byAsin = new Map();
  for (const book of books) if (book.asin) {
    const key = book.asin.trim().toUpperCase();
    if (byAsin.has(key)) byAsin.set(key, null);
    else byAsin.set(key, String(book.id));
  }
  const sales = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length !== 5) return { error: "Row " + (i+1) + ": expected five columns" };
    const asin = cells[0].trim().toUpperCase(), bookId = byAsin.get(asin);
    if (!bookId) return { error: "Row " + (i+1) + ": ASIN not found or ambiguous" };
    const rawUnits = cells[2].trim();
    const { sale, error } = validateSale({
      book_id: bookId, sale_date: cells[1].trim(), units: /^\d+$/.test(rawUnits) ? Number(rawUnits) : NaN,
      royalties: cells[3].trim(), currency: cells[4].trim().toUpperCase()
    });
    if (error) return { error: "Row " + (i+1) + ": " + error };
    sales.push({ ...sale, source: "csv" });
  }
  return { sales };
}
