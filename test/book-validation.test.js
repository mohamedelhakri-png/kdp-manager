import test from "node:test";
import assert from "node:assert/strict";
import { validateBook, validBookId } from "../database/book-validation.js";
test("valid book fields are normalized", () => {
  const result = validateBook({ title: "  My Book  ", status: "published", publication_date: "2026-11-05" });
  assert.equal(result.book.title, "My Book");
  assert.equal(result.book.status, "published");
  assert.equal(result.book.subtitle, null);
});
test("invalid book fields are rejected", () => {
  for (const data of [{}, { title: "" }, { title: "a", status: "deleted" }, { title: "a", publication_date: "2026-02-30" }, { title: "a", unknown: 1 }, { title: "a".repeat(256) }, { title: 7 }]) {
    assert.ok(validateBook(data).error, JSON.stringify(data));
  }
});
test("book IDs respect unsigned bigint limits", () => {
  assert.equal(validBookId("1"), true);
  assert.equal(validBookId("18446744073709551615"), true);
  for (const id of ["0", "-1", "1 OR 1=1", "18446744073709551616", "01"]) assert.equal(validBookId(id), false);
});
