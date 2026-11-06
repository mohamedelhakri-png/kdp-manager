import { createDatabasePool } from "../database/connection.js";
const pool = createDatabasePool();
try {
  await pool.query(`CREATE TABLE IF NOT EXISTS google_drive_grants (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    encrypted_grant TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  const [rows] = await pool.query("SHOW TABLES LIKE 'google_drive_grants'");
  if (!rows.length) throw new Error("Grant storage table unavailable");
  console.log("Encrypted Google Drive grant table ready; existing books and sales unchanged.");
} catch (error) {
  console.error("Grant storage migration failed:", error.code || error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
