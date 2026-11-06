import { createDatabasePool } from './connection.js';

export async function importDriveDraft(file) {
  const pool = createDatabasePool();
  const connection = await pool.getConnection();
  const lockName = 'kdp_drive_' + file.id.slice(0, 45);
  let locked = false;
  try {
    const [[lock]] = await connection.query('SELECT GET_LOCK(?, 8) AS acquired', [lockName]);
    if (lock.acquired !== 1) return { status: 409, error: 'Import busy; retry shortly' };
    locked = true;
    await connection.beginTransaction();
    const [existing] = await connection.execute('SELECT book_id FROM drive_book_files WHERE drive_file_id = ? LIMIT 1', [file.id]);
    if (existing.length) {
      await connection.rollback();
      return { imported: false, alreadyLinked: true, bookId: String(existing[0].book_id) };
    }
    const title = file.name.replace(/\.(docx?|pdf|epub)$/i, '').trim().slice(0, 255);
    if (!title) { await connection.rollback(); return { status: 422, error: 'File has no usable title' }; }
    const [book] = await connection.execute(
      'INSERT INTO books (title, subtitle, author, asin, isbn, category, format, status, publication_date, notes) VALUES (?, NULL, NULL, NULL, NULL, NULL, NULL, ?, NULL, ?)',
      [title, 'draft', 'Imported from Google Drive filename; provisional title. Review before publishing.']
    );
    await connection.execute(
      'INSERT INTO drive_book_files (book_id, drive_file_id, file_role, file_name, mime_type) VALUES (?, ?, ?, ?, ?)',
      [book.insertId, file.id, 'manuscript', file.name.slice(0,255), file.mimeType || null]
    );
    await connection.commit();
    return { imported: true, bookId: String(book.insertId), title };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (locked) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
    connection.release();
    await pool.end();
  }
}
