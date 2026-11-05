// Read-only report inspection. Never interpret report totals as sales without an explicit mapping.
export function inspectKdpReport(csv) {
  if (typeof csv !== "string" || Buffer.byteLength(csv,"utf8") > 262144) return { error: "Report exceeds 256 KB" };
  const input = csv.replace(/^\uFEFF/, "");
  const records = [];
  let cells=[],field="",quoted=false,ended=false;
  for(let i=0;i<input.length;i++){
    const c=input[i];
    if(quoted){if(c==='"'&&input[i+1]==='"'){field+='"';i++}else if(c==='"'){quoted=false;ended=true}else field+=c}
    else if(c==='"'&&!field&&!ended) quoted=true;
    else if(c===','){cells.push(field);field="";ended=false}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&input[i+1]==='\n')i++;cells.push(field);if(cells.some(v=>v.trim()))records.push(cells);cells=[];field="";ended=false}
    else if(ended||c==='"')return {error:"Invalid CSV quoting"};
    else field+=c;
    if(records.length>1001)return {error:"Preview supports at most 1000 rows"};
  }
  if(quoted)return {error:"Unterminated CSV quote"};
  cells.push(field);if(cells.some(v=>v.trim()))records.push(cells);
  if(!records.length)return {error:"Empty report"};
  const headers=records[0].map(x=>x.trim());
  if(headers.length>100||headers.some(x=>!x||x.length>150))return {error:"Invalid report header"};
  const normalized=headers.map(x=>x.toLowerCase().replace(/[^a-z0-9]/g,""));
  if(new Set(normalized).size!==normalized.length)return {error:"Duplicate column names"};
  const names=new Set(normalized);
  const has=(...keys)=>keys.some(k=>names.has(k));
  const indicators={
    asin:has("asin"),
    date:has("date","orderdate","transactiondate","royaltydate","saledate"),
    units:has("units","unitssold","netunitssold","paidunits","quantity"),
    royalties:has("royalty","royalties","royaltyearned","royaltyamount"),
    currency:has("currency","royaltycurrency","paymentcurrency")
  };
  let classification="unknown";
  if(headers.join(",").toLowerCase()==="asin,sale_date,units,royalties,currency")classification="normalized_sales";
  else if(indicators.asin&&indicators.date&&indicators.units&&indicators.royalties)classification="possible_kdp_sales";
  else if(has("paymentdate","paymentamount","paymentstatus"))classification="possible_payment_report";
  else if(indicators.units&&indicators.asin)classification="possible_orders_report";
  const issues=[];
  if(classification!=="normalized_sales")issues.push("Import disabled: native report format requires verified column mapping and accounting semantics");
  if(!indicators.currency)issues.push("Currency column not identified");
  const malformed=records.slice(1).findIndex(row=>row.length!==headers.length);
  if(malformed>=0)issues.push("Row "+(malformed+2)+" has a different number of columns");
  return {classification,headers,rows:records.length-1,indicators,issues,importSupported:classification==="normalized_sales"&&malformed<0};
}
