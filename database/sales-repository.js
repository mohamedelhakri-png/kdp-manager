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
    },
    async importCsv(sales) {
      if (!Array.isArray(sales) || sales.length < 1 || sales.length > 500) throw new Error("Invalid batch size");
      const connection = await db().getConnection();
      let locked = false;
      try {
        const [[lock]] = await connection.query("SELECT GET_LOCK('kdp_sales_csv_import', 10) AS acquired");
        if (lock.acquired !== 1) throw new Error("Import busy");
        locked = true;
        await connection.beginTransaction();
        const [existing] = await connection.query("SELECT book_id, sale_date, units, royalties, currency FROM sales_records WHERE source = 'csv'");
        const key = s => [String(s.book_id), String(s.sale_date).slice(0,10), String(s.units), Number(s.royalties).toFixed(2), s.currency].join("|");
        const seen = new Set(existing.map(key));
        let inserted = 0, skipped = 0;
        for (const sale of sales) {
          const fingerprint = key(sale);
          if (seen.has(fingerprint)) { skipped++; continue; }
          await connection.execute("INSERT INTO sales_records (book_id, sale_date, units, royalties, currency, source) VALUES (?, ?, ?, ?, ?, 'csv')", [sale.book_id, sale.sale_date, sale.units, sale.royalties, sale.currency]);
          seen.add(fingerprint);
          inserted++;
        }
        await connection.commit();
        return { inserted, skipped };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        if (locked) await connection.query("SELECT RELEASE_LOCK('kdp_sales_csv_import')");
        connection.release();
      }
    }
  };
}
