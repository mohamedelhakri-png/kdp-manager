import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { createDatabasePool } from "../database/connection.js";
const scrypt = promisify(scryptCallback);
const sessions = new Map();
const attempts = new Map();
const MAX_AGE = 8 * 60 * 60 * 1000;
const WINDOW = 15 * 60 * 1000;
export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password) > 1024) throw new Error("Password must contain at least 12 characters");
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return "scrypt:" + salt + ":" + hash.toString("hex");
}
export async function verifyPassword(password, stored) {
  if (typeof password !== "string" || Buffer.byteLength(password) > 1024 || typeof stored !== "string") return false;
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt" || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const hash = await scrypt(password, parts[1], 64);
  return timingSafeEqual(hash, Buffer.from(parts[2], "hex"));
}
function send(res, status, data, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers });
  res.end(JSON.stringify(data));
}
function cookie(req) {
  const match = /(?:^|;\s*)kdp_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || "");
  return match?.[1];
}
function sessionKey(token) { return createHash("sha256").update(token).digest("hex"); }
function setCookie(token, maxAge) { return "kdp_session=" + token + "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=" + maxAge; }
export function isAuthenticated(req) {
  const token = cookie(req);
  if (!token) return false;
  const key = sessionKey(token), session = sessions.get(key);
  if (!session) return false;
  if (session.expires <= Date.now()) { sessions.delete(key); return false; }
  return true;
}
export function createAuthHandler(poolFactory = createDatabasePool) {
  let sharedPool;
  return async function handleAuth(req, res, path) {
    if (path === "/api/auth/session" && req.method === "GET") {
      send(res, 200, { authenticated: isAuthenticated(req) });
      return true;
    }
    if (path === "/api/auth/logout" && req.method === "POST") {
      const token = cookie(req);
      if (token) sessions.delete(sessionKey(token));
      send(res, 200, { ok: true }, { "Set-Cookie": setCookie("", 0) });
      return true;
    }
    if (path !== "/api/auth/login") return false;
    if (req.method !== "POST") { send(res, 405, { error: "Method not allowed" }); return true; }
    const ip = req.socket.remoteAddress || "unknown";
    const record = attempts.get(ip);
    if (record && record.until > Date.now() && record.count >= 5) { send(res, 429, { error: "Too many attempts" }); return true; }
    if (!record || record.until <= Date.now()) attempts.set(ip, { count: 0, until: Date.now() + WINDOW });
    const current = attempts.get(ip);
    let body = "";
    try {
      for await (const chunk of req) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 4096) { send(res, 413, { error: "Request too large" }); return true; }
      }
      const parsed = JSON.parse(body);
      const username = parsed?.username, password = parsed?.password;
      if (typeof username !== "string" || username.length > 100 || typeof password !== "string" || Buffer.byteLength(password) > 1024) {
        current.count++; send(res, 401, { error: "Invalid credentials" }); return true;
      }
      const pool = sharedPool ||= poolFactory();
      const [rows] = await pool.execute("SELECT id, password_hash FROM admin_users WHERE username = ? LIMIT 1", [username]);
      const valid = rows.length === 1 && await verifyPassword(password, rows[0].password_hash);
      if (!valid) { current.count++; send(res, 401, { error: "Invalid credentials" }); return true; }
      attempts.delete(ip);
      const token = randomBytes(32).toString("hex");
      sessions.set(sessionKey(token), { id: String(rows[0].id), expires: Date.now() + MAX_AGE });
      send(res, 200, { ok: true }, { "Set-Cookie": setCookie(token, MAX_AGE / 1000) });
    } catch (error) {
      if (error instanceof SyntaxError) { current.count++; send(res, 400, { error: "Invalid JSON" }); }
      else { console.error(JSON.stringify({ level: "ERROR", event: "auth_login_failed", code: error.code || "INTERNAL_ERROR" })); send(res, 503, { error: "Authentication temporarily unavailable" }); }
    }
    return true;
  };
}
