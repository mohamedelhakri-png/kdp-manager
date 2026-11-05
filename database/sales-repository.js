import { createDatabasePool } from "./connection.js";
export function createSalesRepository(poolFactory = createDatabasePool) {
  let pool;
  const db = () => pool ||= poolFactory();
  return {
    async list() {
      const [rows] = await db().execute("SELECT s.id, s.book_id, b.title AS book_title, s.sale_date, s.units, s.royalties, s.currency, s.source, s.created_at FROM sales_records s JOIN books b ON b.id = s.book_id ORDER BY s.sale_date DESC, s.id DESC LIMIT 500");
      return rows.map(row => ({ ...row, id: String(row.id), book_id: String(row.book_id), royalties: String(row.royalties) }));
    },
    async create(sale) {
      const [books] = await db().execute("SELECT id FROM books WHERE id = ? LIMIT 1", [sale.book_id]);
      if (!books.length) return null;
      const [result] = await db().execute("INSERT INTO sales_records (book_id, sale_date, units, royalties, currency, source) VALUES (?, ?, ?, ?, ?, ?)", [sale.book_id, sale.sale_date, sale.units, sale.royalties, sale.currency, sale.source]);
      return { id: String(result.insertId) };
    }
  };
}
