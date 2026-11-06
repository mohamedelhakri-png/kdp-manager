import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createDatabasePool } from "../database/connection.js";

function encryptionKey() {
  const value = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || "";
  if (!/^[a-fA-F0-9]{64}$/.test(value)) return null;
  return Buffer.from(value, "hex");
}
export function persistenceConfigured() { return !!encryptionKey(); }
function encrypt(data, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}
function decrypt(payload, key) {
  const bytes = Buffer.from(payload, "base64");
  if (bytes.length < 29) throw new Error("Invalid encrypted grant");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
}
export async function loadStoredGrant() {
  const key = encryptionKey();
  if (!key) return null;
  const pool = createDatabasePool();
  try {
    const [rows] = await pool.execute("SELECT encrypted_grant FROM google_drive_grants WHERE id = 1 LIMIT 1");
    return rows.length ? decrypt(rows[0].encrypted_grant, key) : null;
  } finally { await pool.end(); }
}
export async function saveStoredGrant(grant) {
  const key = encryptionKey();
  if (!key) return false;
  const pool = createDatabasePool();
  try {
    await pool.execute("INSERT INTO google_drive_grants (id, encrypted_grant) VALUES (1, ?) ON DUPLICATE KEY UPDATE encrypted_grant = VALUES(encrypted_grant)", [encrypt(grant, key)]);
    return true;
  } finally { await pool.end(); }
}
export async function deleteStoredGrant() {
  if (!encryptionKey()) return false;
  const pool = createDatabasePool();
  try { await pool.execute("DELETE FROM google_drive_grants WHERE id = 1"); return true; }
  finally { await pool.end(); }
}
