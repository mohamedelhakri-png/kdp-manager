import { createDatabasePool } from "./connection.js";

export function createExpensesRepository(poolFactory = createDatabasePool) {
  let pool;
  const db = () => pool ||= poolFactory();
  return {
    async list() {
      const [rows] = await db().execute(
        "SELECT e.id, e.book_id, b.title AS book_title, DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS expense_date, e.category, e.description, e.amount, e.currency FROM expenses e LEFT JOIN books b ON b.id=e.book_id ORDER BY e.expense_date DESC, e.id DESC LIMIT 500"
      );
      return rows.map(row => ({ ...row, id: String(row.id), book_id: row.book_id == null ? null : String(row.book_id), amount: String(row.amount) }));
    },
    async create(expense) {
      const [result] = await db().execute(
        "INSERT INTO expenses (book_id, expense_date, category, description, amount, currency) VALUES (?, ?, ?, ?, ?, ?)",
        [expense.book_id, expense.expense_date, expense.category, expense.description, expense.amount, expense.currency]
      );
      return { id: String(result.insertId), ...expense };
    },
    async summary() {
      const [rows] = await db().execute(
        "SELECT currency, SUM(amount) AS expenses FROM expenses GROUP BY currency ORDER BY currency"
      );
      return rows.map(row => ({ currency: row.currency, expenses: String(row.expenses) }));
    }
  };
}
