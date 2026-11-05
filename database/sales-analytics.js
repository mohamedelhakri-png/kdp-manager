import { createDatabasePool } from "./connection.js";

export function createSalesAnalyticsRepository(poolFactory = createDatabasePool) {
  let pool;
  const db = () => pool ||= poolFactory();
  return {
    async byMonth() {
      const [rows] = await db().execute(
        "SELECT DATE_FORMAT(sale_date, '%Y-%m') AS month, currency, SUM(units) AS units, SUM(royalties) AS royalties FROM sales_records GROUP BY DATE_FORMAT(sale_date, '%Y-%m'), currency ORDER BY month DESC, currency LIMIT 120"
      );
      return rows.map(row => ({ month: row.month, currency: row.currency, units: Number(row.units), royalties: String(row.royalties) }));
    },
    async byBook() {
      const [rows] = await db().execute(
        "SELECT b.id AS book_id, b.title AS book_title, s.currency, SUM(s.units) AS units, SUM(s.royalties) AS royalties FROM sales_records s INNER JOIN books b ON b.id = s.book_id GROUP BY b.id, b.title, s.currency ORDER BY SUM(s.units) DESC, b.title LIMIT 200"
      );
      return rows.map(row => ({ book_id: String(row.book_id), book_title: row.book_title, currency: row.currency, units: Number(row.units), royalties: String(row.royalties) }));
    }
  };
}
