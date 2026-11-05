import test from "node:test";
import assert from "node:assert/strict";
import { createProfitRepository } from "../database/profit-repository.js";

function mockPool() {
  const calls = [];
  const pool = { async execute(sql, params) {
    calls.push({ sql, params });
    if (sql.includes("FROM sales_records")) return [[{ currency: "USD", amount: "120.50" }, { currency: "EUR", amount: "10.00" }]];
    if (sql.includes("FROM expenses")) return [[{ currency: "USD", amount: "30.25" }, { currency: "GBP", amount: "5.00" }]];
    throw new Error("Unexpected query");
  }};
  return { pool, calls };
}

test("profit summary keeps currencies separate and includes expense-only currencies", async () => {
  const { pool, calls } = mockPool();
  const totals = await createProfitRepository(() => pool).summary();
  assert.deepEqual(totals, [
    { currency: "EUR", royalties: "10.00", expenses: "0.00", net_profit: "10.00" },
    { currency: "GBP", royalties: "0.00", expenses: "5.00", net_profit: "-5.00" },
    { currency: "USD", royalties: "120.50", expenses: "30.25", net_profit: "90.25" }
  ]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].params, []);
});

test("monthly filter uses parameterized bounded dates for both tables", async () => {
  const { pool, calls } = mockPool();
  await createProfitRepository(() => pool).summary({ month: "2026-11" });
  assert.deepEqual(calls[0].params, ["2026-11-01", "2026-11-01"]);
  assert.deepEqual(calls[1].params, ["2026-11-01", "2026-11-01"]);
  assert.match(calls[0].sql, /sale_date >= \?/);
  assert.match(calls[1].sql, /expense_date >= \?/);
});

test("invalid month is rejected before any database access", async () => {
  const { pool, calls } = mockPool();
  await assert.rejects(createProfitRepository(() => pool).summary({ month: "2026-13" }), /Invalid month/);
  assert.equal(calls.length, 0);
});
