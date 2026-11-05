import { createDatabasePool } from "./connection.js";

export function createSalesAnalyticsRepository(poolFactory = createDatabasePool) {
  let pool;
  const db = () => pool ||= poolFactory();
  return {
    async filtered({ month = "", bookId = "" } = {}) {
      if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month");
      if (bookId && !/^[1-9]\d{0,18}$/.test(bookId)) throw new Error("Invalid book ID");
      const where = [];
      const params = [];
      if (month) { where.push("s.sale_date >= ? AND s.sale_date < DATE_ADD(?, INTERVAL 1 MONTH)"); params.push(month + "-01", month + "-01"); }
      if (bookId) { where.push("s.book_id = ?"); params.push(bookId); }
      const filter = where.length ? " WHERE " + where.join(" AND ") : "";
      const from = " FROM sales_records s INNER JOIN books b ON b.id = s.book_id" + filter;
      const [monthly] = await db().execute(
        "SELECT DATE_FORMAT(s.sale_date, '%Y-%m') AS month, s.currency, SUM(s.units) AS units, SUM(s.royalties) AS royalties" + from + " GROUP BY DATE_FORMAT(s.sale_date, '%Y-%m'), s.currency ORDER BY month DESC, s.currency LIMIT 240", params
      );
      const [byBook] = await db().execute(
        "SELECT b.id AS book_id, b.title AS book_title, s.currency, SUM(s.units) AS units, SUM(s.royalties) AS royalties" + from + " GROUP BY b.id, b.title, s.currency ORDER BY SUM(s.units) DESC, b.title LIMIT 500", params
      );
      return {
        monthly: monthly.map(r => ({ month: r.month, currency: r.currency, units: Number(r.units), royalties: String(r.royalties) })),
        byBook: byBook.map(r => ({ book_id: String(r.book_id), book_title: r.book_title, currency: r.currency, units: Number(r.units), royalties: String(r.royalties) }))
      };
    },
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
