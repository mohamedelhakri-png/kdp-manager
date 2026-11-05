import test from "node:test";
import assert from "node:assert/strict";
import { validateExpense } from "../database/expenses-validation.js";

const sample = { expense_date: "2026-11-05", category: "cover", description: "Cover design", amount: "25.50", currency: "USD", book_id: null };

test("accepts a valid expense", () => {
  assert.deepEqual(validateExpense(sample).value, { ...sample, amount: "25.50" });
});

test("rejects invalid amount and impossible date", () => {
  assert.ok(validateExpense({ ...sample, amount: "-1" }).error);
  assert.ok(validateExpense({ ...sample, amount: "1.234" }).error);
  assert.ok(validateExpense({ ...sample, expense_date: "2026-02-30" }).error);
});

test("rejects unrecognized categories and malformed book IDs", () => {
  assert.ok(validateExpense({ ...sample, category: "unknown" }).error);
  assert.ok(validateExpense({ ...sample, book_id: "1 OR 1=1" }).error);
});
