import mysql from "mysql2/promise";

// Additive foundation only. No Google credentials or Drive API calls are used.
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
  if (!books.length) throw new Error("Books table missing; refusing Drive mapping migration");
  await connection.query(`
    CREATE TABLE IF NOT EXISTS drive_book_files (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      book_id BIGINT UNSIGNED NOT NULL,
      drive_file_id VARCHAR(255) NOT NULL,
      file_role ENUM('manuscript','cover','other') NOT NULL DEFAULT 'other',
      file_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(150) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_drive_book_file_role (book_id, drive_file_id, file_role),
      KEY idx_drive_file_id (drive_file_id),
      CONSTRAINT fk_drive_book_files_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);
  const [rows] = await connection.query("SHOW TABLES LIKE 'drive_book_files'");
  if (!rows.length) throw new Error("Drive mapping table verification failed");
  console.log("Drive mapping foundation verified. No book records or Drive files modified.");
} catch (error) {
  console.error("Drive mapping migration failed:", error.code || error.message);
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
}
