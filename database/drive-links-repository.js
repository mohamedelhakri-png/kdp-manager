import { createDatabasePool } from './connection.js';
export async function listDriveLinks() {
  const pool = createDatabasePool();
  try {
    const [rows] = await pool.execute('SELECT book_id, drive_file_id, file_role, file_name FROM drive_book_files ORDER BY id DESC LIMIT 500');
    return rows;
  } finally { await pool.end(); }
}
