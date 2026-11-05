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
