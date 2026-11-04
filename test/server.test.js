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

test("Books endpoint returns demo data", async () => {
  const result = await request("/books");
  assert.equal(result.status, 200);
  assert.equal(result.body.demo, true);
});

test("Unknown routes return 404", async () => {
  const result = await request("/missing");
  assert.equal(result.status, 404);
});

test("Write requests are rejected", async () => {
  const result = await request("/books", "POST");
  assert.equal(result.status, 405);
});
