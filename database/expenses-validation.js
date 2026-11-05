export const expenseCategories = Object.freeze(["cover", "editing", "advertising", "software", "formatting", "other"]);

export function validateExpense(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Invalid expense" };
  const expenseDate = value.expense_date;
  if (typeof expenseDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) || Number.isNaN(Date.parse(expenseDate + "T00:00:00Z")) || new Date(expenseDate + "T00:00:00Z").toISOString().slice(0,10) !== expenseDate) return { error: "Invalid expense date" };
  const category = value.category;
  if (!expenseCategories.includes(category)) return { error: "Invalid expense category" };
  const description = typeof value.description === "string" ? value.description.trim() : "";
  if (!description || description.length > 255) return { error: "Description must contain 1-255 characters" };
  const currency = value.currency;
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) return { error: "Invalid currency" };
  const rawAmount = value.amount;
  if (!(typeof rawAmount === "string" || typeof rawAmount === "number") || !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(String(rawAmount))) return { error: "Invalid amount" };
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99) return { error: "Amount must be positive" };
  const bookId = value.book_id == null || value.book_id === "" ? null : String(value.book_id);
  if (bookId !== null && !/^[1-9]\d{0,18}$/.test(bookId)) return { error: "Invalid book ID" };
  return { value: { book_id: bookId, expense_date: expenseDate, category, description, amount: amount.toFixed(2), currency } };
}
