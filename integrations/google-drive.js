import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { isAuthenticated } from "../auth/auth.js";

const pending = new Map();
let grant = null;
const MAX_PENDING = 30;
const TTL = 10 * 60 * 1000;
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const FOLDER = /^[a-zA-Z0-9_-]{10,}$/.test(process.env.GOOGLE_DRIVE_FOLDER_ID || "") ? process.env.GOOGLE_DRIVE_FOLDER_ID : null;
function config() {
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret, GOOGLE_REDIRECT_URI: redirect } = process.env;
  if (!id || !secret || !redirect || !FOLDER) return null;
  try { const url = new URL(redirect); if (url.protocol !== "https:" || url.pathname !== "/auth/google/callback") return null; } catch { return null; }
  return { id, secret, redirect };
}
function sessionFingerprint(req) {
  const cookie = /(?:^|;\\s*)kdp_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || "")?.[1];
  return cookie ? createHash("sha256").update(cookie).digest() : null;
}
function respond(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(body));
}
function redirect(res, location) { res.writeHead(302, { Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }); res.end(); }
function cleanPending() { for (const [key, value] of pending) if (value.expires < Date.now()) pending.delete(key); }
async function tokenRequest(params) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params), signal: AbortSignal.timeout(12000)
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error("Google token exchange failed");
  return result;
}
async function accessToken(cfg) {
  if (!grant) return null;
  if (grant.expires > Date.now() + 60000) return grant.access;
  if (!grant.refresh) { grant = null; return null; }
  try {
    const next = await tokenRequest({ client_id: cfg.id, client_secret: cfg.secret, refresh_token: grant.refresh, grant_type: "refresh_token" });
    grant = { access: next.access_token, refresh: next.refresh_token || grant.refresh, expires: Date.now() + next.expires_in * 1000 };
    return grant.access;
  } catch { grant = null; return null; }
}
export async function handleGoogleDrive(req, res, path) {
  if (!["/auth/google/start", "/auth/google/callback", "/api/drive/status", "/api/drive/files", "/api/drive/disconnect"].includes(path)) return false;
  if (!isAuthenticated(req)) { respond(res, 401, { error: "Administrator authentication required" }); return true; }
  const cfg = config();
  if (!cfg) { respond(res, 503, { error: "Google Drive configuration incomplete" }); return true; }
  const url = new URL(req.url, "http://localhost");
  if (path === "/api/drive/status" && req.method === "GET") {
    respond(res, 200, { configured: true, connected: !!grant, persistence: "process-memory", folderId: FOLDER }); return true;
  }
  if (path === "/auth/google/start" && req.method === "GET") {
    cleanPending();
    if (pending.size >= MAX_PENDING) { respond(res, 429, { error: "Too many pending authorizations" }); return true; }
    const fingerprint = sessionFingerprint(req);
    if (!fingerprint) { respond(res, 401, { error: "Session unavailable" }); return true; }
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    pending.set(state, { fingerprint, verifier, expires: Date.now() + TTL });
    const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    for (const [key, value] of Object.entries({
      client_id: cfg.id, redirect_uri: cfg.redirect, response_type: "code", scope: SCOPE,
      access_type: "offline", prompt: "consent", state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256"
    })) target.searchParams.set(key, value);
    redirect(res, target.toString()); return true;
  }
  if (path === "/auth/google/callback" && req.method === "GET") {
    const state = url.searchParams.get("state") || "";
    const attempt = pending.get(state);
    pending.delete(state);
    const fingerprint = sessionFingerprint(req);
    if (!attempt || attempt.expires < Date.now() || !fingerprint || !timingSafeEqual(fingerprint, attempt.fingerprint)) {
      respond(res, 403, { error: "Invalid or expired authorization state" }); return true;
    }
    const code = url.searchParams.get("code");
    if (!code || url.searchParams.has("error")) { respond(res, 400, { error: "Google authorization declined" }); return true; }
    try {
      const result = await tokenRequest({
        client_id: cfg.id, client_secret: cfg.secret, redirect_uri: cfg.redirect,
        code, code_verifier: attempt.verifier, grant_type: "authorization_code"
      });
      grant = { access: result.access_token, refresh: result.refresh_token || null, expires: Date.now() + result.expires_in * 1000 };
      redirect(res, "/?drive=connected");
    } catch { respond(res, 502, { error: "Google authorization could not be completed" }); }
    return true;
  }
  if (path === "/api/drive/disconnect" && req.method === "POST") {
    const origin = req.headers.origin;
    if (origin && origin !== "https://" + req.headers.host) { respond(res, 403, { error: "Forbidden" }); return true; }
    grant = null; respond(res, 200, { connected: false }); return true;
  }
  if (path === "/api/drive/files" && req.method === "GET") {
    const token = await accessToken(cfg);
    if (!token) { respond(res, 409, { error: "Google Drive not connected" }); return true; }
    const files = [];
    let pageToken = "";
    try {
      for (let page = 0; page < 20; page++) {
        const endpoint = new URL("https://www.googleapis.com/drive/v3/files");
        endpoint.searchParams.set("q", "'" + FOLDER + "' in parents and trashed = false");
        endpoint.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink)");
        endpoint.searchParams.set("pageSize", "100");
        if (pageToken) endpoint.searchParams.set("pageToken", pageToken);
        const response = await fetch(endpoint, { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error("Drive API failed");
        const data = await response.json();
        files.push(...(data.files || []));
        pageToken = data.nextPageToken || "";
        if (!pageToken) break;
      }
      respond(res, 200, { folderId: FOLDER, files, truncated: !!pageToken, readOnly: true });
    } catch { respond(res, 502, { error: "Could not list Google Drive files" }); }
    return true;
  }
  respond(res, 405, { error: "Method not allowed" }); return true;
}
