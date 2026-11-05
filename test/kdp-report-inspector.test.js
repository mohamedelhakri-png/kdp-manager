import test from "node:test";
import assert from "node:assert/strict";
import { inspectKdpReport } from "../database/kdp-report-inspector.js";
test("identifies normalized import",()=>assert.equal(inspectKdpReport("asin,sale_date,units,royalties,currency\nB012345678,2026-11-05,1,2.00,USD").importSupported,true));
test("does not automatically import possible native KDP report",()=>{const x=inspectKdpReport("ASIN,Order Date,Units,Royalty,Currency\nB012345678,2026-11-05,1,2.00,USD");assert.equal(x.classification,"possible_kdp_sales");assert.equal(x.importSupported,false)});
test("rejects malformed CSV",()=>assert.ok(inspectKdpReport('asin,units\n"bad').error));
test("rejects duplicate headers",()=>assert.ok(inspectKdpReport("ASIN,asin\n1,2").error));
test("flags inconsistent columns",()=>assert.equal(inspectKdpReport("asin,sale_date,units,royalties,currency\nB01,2026-11-05,1").importSupported,false));
