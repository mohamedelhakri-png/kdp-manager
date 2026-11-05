import { createDatabasePool } from "../database/connection.js";

export function createBooksRepository(poolFactory = createDatabasePool) {
  let pool;
  const db = () => pool ||= poolFactory();
  return {
    async list() {
      const [rows] = await db().execute(
        "SELECT id, title, subtitle, author, asin, isbn, category, format, status, publication_date, notes, created_at, updated_at FROM books ORDER BY created_at DESC, id DESC LIMIT 500"
      );
      return rows.map(row => ({ ...row, id: String(row.id) }));
    },
    async summary() {
      const [[counts], [sales]] = await Promise.all([
        db().execute("SELECT COUNT(*) AS total_books, SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_books FROM books"),
        db().execute("SELECT COALESCE(SUM(units),0) AS units_sold FROM sales_records")
      ]);
      return {
        totalBooks: Number(counts[0].total_books),
        publishedBooks: Number(counts[0].published_books || 0),
        unitsSold: Number(sales[0].units_sold)
      };
    },
    async salesSummary() {
      const [rows] = await db().execute(
        "SELECT currency, COALESCE(SUM(units),0) AS units, COALESCE(SUM(royalties),0) AS royalties FROM sales_records GROUP BY currency ORDER BY currency"
      );
      return rows.map(row => ({
        currency: row.currency,
        units: Number(row.units),
        royalties: String(row.royalties)
      }));
    }
  };
}
