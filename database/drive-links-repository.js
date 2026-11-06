import { createDatabasePool } from './connection.js';
export async function listDriveLinks() {
  const pool = createDatabasePool();
  try {
    const [rows] = await pool.execute('SELECT book_id, drive_file_id, file_role, file_name FROM drive_book_files ORDER BY id DESC LIMIT 500');
    return rows;
  } finally { await pool.end(); }
}

export async function saveDriveLink(bookId, file) {
  const pool = createDatabasePool();
  try {
    const [books] = await pool.execute('SELECT id FROM books WHERE id = ? LIMIT 1', [bookId]);
    if (!books.length) return { error: 'Book not found', status: 404 };
    const [existing] = await pool.execute('SELECT book_id, file_role FROM drive_book_files WHERE drive_file_id = ? LIMIT 1', [file.id]);
    if (existing.length) {
      if (String(existing[0].book_id) === String(bookId)) return { linked: true, alreadyLinked: true };
      return { error: 'Drive file already linked to another book', status: 409 };
    }
    await pool.execute('INSERT INTO drive_book_files (book_id, drive_file_id, file_role, file_name, mime_type) VALUES (?, ?, ?, ?, ?)', [bookId, file.id, 'other', file.name.slice(0,255), file.mimeType || null]);
    return { linked: true, alreadyLinked: false };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return { error: 'Duplicate Drive link', status: 409 };
    throw error;
  } finally { await pool.end(); }
}
