import mysql from "mysql2/promise";

const required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error("Missing database configuration: " + missing.join(", "));
  process.exit(1);
}

let connection;
try {
  connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false
  });
  const [books] = await connection.query("SHOW TABLES LIKE 'books'");
  if (!books.length) throw new Error("Books table missing; refusing expenses migration");
  await connection.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      book_id BIGINT UNSIGNED NULL,
      expense_date DATE NOT NULL,
      category VARCHAR(60) NOT NULL,
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      currency CHAR(3) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_expenses_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
    )
  `);
  const [rows] = await connection.query("SHOW TABLES LIKE 'expenses'");
  if (!rows.length) throw new Error("Expenses table verification failed");
  console.log("Expenses migration verified. Existing tables and records unchanged.");
} catch (error) {
  console.error("Expenses migration failed:", error.code || error.message);
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
}
