import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";

const { server } = await import("../server.js");

async function request(path, method = "GET") {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", async () => {
      try {
        const address = server.address();
        const response = await fetch(
          `http://127.0.0.1:${address.port}${path}`,
          { method }
        );
        const body = await response.json();
        server.close(() => resolve({
          status: response.status,
          body
        }));
      } catch (error) {
        server.close();
        reject(error);
      }
    });
  });
}

test("Health endpoint works", async () => {
  const result = await request("/health");
  assert.equal(result.status, 200);
  assert.equal(result.body.status, "ok");
});

test("Books endpoint requires authentication", async () => {
  const result = await request("/books");
  assert.equal(result.status, 401);
});

test("Unknown routes return 404", async () => {
  const result = await request("/missing");
  assert.equal(result.status, 404);
});

test("Unauthenticated writes are rejected", async () => {
  const result = await request("/books", "POST");
  assert.equal(result.status, 401);
});

test("Summary endpoint requires authentication", async () => {
  const result = await request("/api/summary");
  assert.equal(result.status, 401);
  assert.equal(result.body.error, "Authentication required");
});

test("Login page renders successfully without authentication", async () => {
  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", async () => {
      try {
        const response = await fetch("http://127.0.0.1:" + server.address().port + "/login");
        const html = await response.text();
        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type"), /text\/html/);
        assert.match(html, /id="login-form"/);
        assert.match(html, /api\/auth\/login/);
        server.close(resolve);
      } catch (error) { server.close(); reject(error); }
    });
  });
});
test("Anonymous dashboard access redirects to login", async () => {
  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", async () => {
      try {
        const response = await fetch("http://127.0.0.1:" + server.address().port + "/", { redirect: "manual" });
        assert.equal(response.status, 302);
        assert.equal(response.headers.get("location"), "/login");
        server.close(resolve);
      } catch (error) { server.close(); reject(error); }
    });
  });
});
