import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, createAuthHandler, isAuthenticated } from "../auth/auth.js";
import { Readable } from "node:stream";
test("password hashes are salted and verified", async () => {
  const a = await hashPassword("correct-horse-battery-staple");
  const b = await hashPassword("correct-horse-battery-staple");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("correct-horse-battery-staple", a), true);
  assert.equal(await verifyPassword("wrong-password", a), false);
  assert.equal(await verifyPassword("correct-horse-battery-staple", "invalid"), false);
});
test("short passwords are rejected", async () => {
  await assert.rejects(hashPassword("short"));
});
test("non-auth route is not intercepted", async () => {
  const handler = createAuthHandler(() => { throw new Error("should not connect"); });
  assert.equal(await handler({ method: "GET" }, {}, "/health"), false);
});

test("login rejects cross-origin requests before database access", async () => {
  const handler = createAuthHandler(() => { throw new Error("Database should not be accessed"); });
  const req = { method: "POST", headers: { host: "example.com", origin: "https://attacker.example", "content-type": "application/json" } };
  let status, payload;
  const res = { writeHead(code) { status = code; }, end(data) { payload = JSON.parse(data); } };
  assert.equal(await handler(req, res, "/api/auth/login"), true);
  assert.equal(status, 403);
  assert.equal(payload.error, "Forbidden");
});
test("login rejects unsupported content type", async () => {
  const handler = createAuthHandler(() => { throw new Error("Database should not be accessed"); });
  const req = { method: "POST", headers: { host: "example.com", "content-type": "text/plain" } };
  let status;
  const res = { writeHead(code) { status = code; }, end() {} };
  assert.equal(await handler(req, res, "/api/auth/login"), true);
  assert.equal(status, 415);
});

test("valid credentials create a session and logout revokes it", async () => {
  const password = "secure-test-password-1234";
  const hash = await hashPassword(password);
  const handler = createAuthHandler(() => ({ execute: async () => [[{ id: 1, password_hash: hash }]] }));
  function request(path, body, cookie) {
    const req = Readable.from(body ? [JSON.stringify(body)] : []);
    req.method = "POST";
    req.headers = { host: "example.com", "content-type": "application/json", ...(cookie ? { cookie } : {}) };
    req.socket = { remoteAddress: "test-client-valid" };
    return req;
  }
  function response() {
    return { status: null, headers: null, body: null,
      writeHead(status, headers) { this.status = status; this.headers = headers; },
      end(data) { this.body = data ? JSON.parse(data) : null; } };
  }
  const bad = response();
  await handler(request("/api/auth/login", { username: "admin", password: "wrong-password" }), bad, "/api/auth/login");
  assert.equal(bad.status, 401);
  const good = response();
  await handler(request("/api/auth/login", { username: "admin", password }), good, "/api/auth/login");
  assert.equal(good.status, 200);
  const cookie = good.headers["Set-Cookie"].split(";")[0];
  assert.match(good.headers["Set-Cookie"], /HttpOnly; Secure; SameSite=Strict/);
  assert.equal(isAuthenticated({ headers: { cookie } }), true);
  const logout = response();
  await handler(request("/api/auth/logout", null, cookie), logout, "/api/auth/logout");
  assert.equal(logout.status, 200);
  assert.equal(isAuthenticated({ headers: { cookie } }), false);
});
