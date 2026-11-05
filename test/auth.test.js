import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, createAuthHandler } from "../auth/auth.js";
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
