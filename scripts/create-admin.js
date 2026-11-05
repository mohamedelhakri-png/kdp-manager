import { createDatabasePool } from "../database/connection.js";
import { hashPassword } from "../auth/auth.js";
const username = process.env.KDP_ADMIN_USERNAME;
const password = process.env.KDP_ADMIN_PASSWORD;
if (!username || username.length > 100 || !/^[a-zA-Z0-9_.-]+$/.test(username) || !password) {
  console.error("Set KDP_ADMIN_USERNAME and KDP_ADMIN_PASSWORD in a private execution environment.");
  process.exit(1);
}
let pool;
try {
  const hash = await hashPassword(password);
  pool = createDatabasePool();
  const [result] = await pool.execute("INSERT IGNORE INTO admin_users (username, password_hash) VALUES (?, ?)", [username, hash]);
  console.log(result.affectedRows === 1 ? "Admin account created" : "Admin already exists; no changes made");
} catch (error) {
  console.error("Admin setup failed:", error.code || "INVALID_CONFIGURATION");
  process.exitCode = 1;
} finally { if (pool) await pool.end(); }
