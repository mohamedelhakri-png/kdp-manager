export function validateSale(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Invalid sale" };
  const bookId = String(input.book_id ?? "");
  if (!/^[1-9]\d{0,18}$/.test(bookId)) return { error: "Select a valid book" };
  const saleDate = input.sale_date;
  if (typeof saleDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(saleDate) || !Number.isFinite(Date.parse(saleDate + "T00:00:00Z")) || new Date(saleDate + "T00:00:00Z").toISOString().slice(0,10) !== saleDate) return { error: "Invalid sale date" };
  const units = input.units;
  if (!Number.isSafeInteger(units) || units < 0 || units > 1000000) return { error: "Units must be a nonnegative integer" };
  const royalties = String(input.royalties ?? "");
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(royalties)) return { error: "Invalid royalty amount" };
  const currency = input.currency;
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) return { error: "Currency must be a three-letter uppercase code" };
  return { sale: { book_id: bookId, sale_date: saleDate, units, royalties, currency, source: "manual" } };
}
