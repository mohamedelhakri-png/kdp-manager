import { createDatabasePool } from "./connection.js";

export function createProfitRepository(poolFactory = createDatabasePool) {
  let pool;
  const db = () => pool ||= poolFactory();
  return {
    async summary({ month = "" } = {}) {
      if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month");
      const whereSales = month ? " WHERE sale_date >= ? AND sale_date < DATE_ADD(?, INTERVAL 1 MONTH)" : "";
      const whereExpenses = month ? " WHERE expense_date >= ? AND expense_date < DATE_ADD(?, INTERVAL 1 MONTH)" : "";
      const params = month ? [month + "-01", month + "-01"] : [];
      const [royalties] = await db().execute("SELECT currency, SUM(royalties) AS amount FROM sales_records" + whereSales + " GROUP BY currency", params);
      const [expenses] = await db().execute("SELECT currency, SUM(amount) AS amount FROM expenses" + whereExpenses + " GROUP BY currency", params);
      const totals = new Map();
      for (const row of royalties) totals.set(row.currency, { currency: row.currency, royalties: String(row.amount), expenses: "0.00" });
      for (const row of expenses) {
        const item = totals.get(row.currency) || { currency: row.currency, royalties: "0.00", expenses: "0.00" };
        item.expenses = String(row.amount);
        totals.set(row.currency, item);
      }
      return [...totals.values()].sort((a,b) => a.currency.localeCompare(b.currency)).map(item => ({
        ...item,
        net_profit: ((Math.round(Number(item.royalties) * 100) - Math.round(Number(item.expenses) * 100)) / 100).toFixed(2)
      }));
    }
  };
}
