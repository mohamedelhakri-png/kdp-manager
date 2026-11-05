import test from "node:test";
import assert from "node:assert/strict";
import { createBooksRepository } from "../database/books-repository.js";

test("lists real database rows without changing stored IDs", async () => {
  const calls = [];
  const repo = createBooksRepository(() => ({
    async execute(sql) {
      calls.push(sql);
      return [[{ id: 9007199254740991n, title: "<script>alert(1)</script>", status: "draft" }]];
    }
  }));
  const books = await repo.list();
  assert.equal(books[0].id, "9007199254740991");
  assert.equal(books[0].title, "<script>alert(1)</script>");
  assert.match(calls[0], /FROM books/);
  assert.match(calls[0], /LIMIT 500/);
  assert.doesNotMatch(calls[0], /\b(INSERT|UPDATE|DELETE|DROP)\b/i);
});

test("summary reads books and sales without mixing royalty currencies", async () => {
  const queries = [];
  const repo = createBooksRepository(() => ({
    async execute(sql) {
      queries.push(sql);
      if (sql.includes("COUNT(*)")) return [[{ total_books: 2, published_books: 1 }]];
      if (sql.includes("SUM(units)") && !sql.includes("GROUP BY")) return [[{ units_sold: 8 }]];
      return [[{ currency: "USD", units: 5, royalties: "13.20" }, { currency: "EUR", units: 3, royalties: "7.10" }]];
    }
  }));
  assert.deepEqual(await repo.summary(), { totalBooks: 2, publishedBooks: 1, unitsSold: 8 });
  assert.deepEqual(await repo.salesSummary(), [
    { currency: "USD", units: 5, royalties: "13.20" },
    { currency: "EUR", units: 3, royalties: "7.10" }
  ]);
  assert.equal(queries.length, 3);
  for (const sql of queries) assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|DROP)\b/i);
});

test("create and update use placeholders and preserve existing rows", async () => {
  const calls = [];
  const repo = createBooksRepository(() => ({
    async execute(sql, values) {
      calls.push({ sql, values });
      return sql.startsWith("INSERT") ? [{ insertId: 123n, affectedRows: 1 }] : [{ affectedRows: 1 }];
    }
  }));
  const book = { title: "My book", subtitle: null, author: null, asin: null, isbn: null, category: null, format: null, status: "draft", publication_date: null, notes: null };
  assert.deepEqual(await repo.create(book), { id: "123" });
  assert.equal(await repo.update("123", book), true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].values[0], "My book");
  assert.equal(calls[1].values.at(-1), "123");
  assert.equal((calls[0].sql.match(/\?/g) || []).length, 10);
  assert.equal((calls[1].sql.match(/\?/g) || []).length, 11);
  assert.doesNotMatch(calls.map(c => c.sql).join(" "), /\bDELETE\b|\bDROP\b/i);
});
