const fields = {
  title: 255, subtitle: 255, author: 255, asin: 20, isbn: 20,
  category: 150, format: 50, notes: 10000
};
export function validateBook(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Invalid book data" };
  for (const key of Object.keys(value)) {
    if (!(key in fields) && key !== "status" && key !== "publication_date") return { error: "Unknown field: " + key };
  }
  const book = {};
  for (const [key, max] of Object.entries(fields)) {
    const raw = value[key];
    if (raw !== undefined && raw !== null && typeof raw !== "string") return { error: "Invalid " + key };
    const text = (raw ?? "").trim();
    if (text.length > max) return { error: key + " exceeds " + max + " characters" };
    book[key] = text || null;
  }
  if (!book.title) return { error: "Title is required" };
  const status = value.status ?? "draft";
  if (!["draft", "published", "archived"].includes(status)) return { error: "Invalid status" };
  book.status = status;
  const date = value.publication_date ?? null;
  if (date !== null && date !== "") {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) return { error: "Invalid publication date" };
    book.publication_date = date;
  } else book.publication_date = null;
  return { book };
}
export function validBookId(id) { return typeof id === "string" && /^[1-9]\d{0,19}$/.test(id) && BigInt(id) <= 18446744073709551615n; }
