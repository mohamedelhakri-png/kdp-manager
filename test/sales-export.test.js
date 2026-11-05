import test from "node:test";
import assert from "node:assert/strict";
import { salesToCsv } from "../database/sales-export.js";
test("exports headings and sales",()=>{const csv=salesToCsv([{id:"1",book_id:"2",book_title:"Example",sale_date:"2026-11-05",units:3,royalties:"4.50",currency:"USD",source:"manual"}]);assert.match(csv,/book_title/);assert.match(csv,/2026-11-05/);assert.match(csv,/4.50/)});
test("escapes spreadsheet formulas and embedded quotes",()=>{const csv=salesToCsv([{book_title:'=HYPERLINK("evil")'}]);assert.match(csv,/"'=HYPERLINK\(""evil""\)"/)});
test("exports empty history",()=>assert.match(salesToCsv([]),/book_title/));
