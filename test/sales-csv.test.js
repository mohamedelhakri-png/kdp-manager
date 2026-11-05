import test from "node:test";
import assert from "node:assert/strict";
import { parseSalesCsv } from "../database/sales-csv.js";
const books = [{ id: "1", asin: "B012345678" }];
test("parses normalized CSV", () => {
 const r=parseSalesCsv('asin,sale_date,units,royalties,currency\nB012345678,2026-11-05,2,4.50,USD\n',books);
 assert.equal(r.sales[0].book_id,"1"); assert.equal(r.sales[0].source,"csv");
});
test("handles quoted fields and CRLF",()=>assert.equal(parseSalesCsv('asin,sale_date,units,royalties,currency\r\n"B012345678",2026-11-05,2,4.50,USD\r\n',books).sales.length,1));
test("rejects unknown ASIN",()=>assert.match(parseSalesCsv('asin,sale_date,units,royalties,currency\nUNKNOWN,2026-11-05,2,4.50,USD',books).error,/ASIN/));
test("rejects ambiguous ASIN",()=>assert.match(parseSalesCsv('asin,sale_date,units,royalties,currency\nB012345678,2026-11-05,2,4.50,USD',[...books,{id:"2",asin:"B012345678"}]).error,/ambiguous/));
test("rejects wrong header",()=>assert.ok(parseSalesCsv('date,units\nx,2',books).error));
test("rejects malformed date",()=>assert.ok(parseSalesCsv('asin,sale_date,units,royalties,currency\nB012345678,2026-02-30,2,4.50,USD',books).error));
test("rejects fractional units",()=>assert.ok(parseSalesCsv('asin,sale_date,units,royalties,currency\nB012345678,2026-11-05,2.5,4.50,USD',books).error));
test("rejects unterminated quote",()=>assert.ok(parseSalesCsv('asin,sale_date,units,royalties,currency\n"B012345678,2026-11-05,2,4.50,USD',books).error));
