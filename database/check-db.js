import { createDatabasePool } from "../database/connection.js";

let pool;

try {
  pool = createDatabasePool();

  const [rows] = await pool.query("SHOW TABLES");

  const tables = rows.map((row) => Object.values(row)[0]);
  const required = ["admin_users", "books", "sales_records"];
  const missing = required.filter((name) => !tables.includes(name));

  if (missing.length > 0) {
    console.error("Missing tables:", missing.join(", "));
    process.exitCode = 1;
  } else {
    console.log("Database connection: OK");
    console.log("All 3 required tables: OK");
  }
} catch (error) {
  console.error("Database check failed:", error.code || error.message);
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
