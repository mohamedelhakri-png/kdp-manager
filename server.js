
import http from "node:http";
import { handleGoogleDrive, verifyDriveFile } from "./integrations/google-drive.js";
import { listDriveLinks, saveDriveLink } from "./database/drive-links-repository.js";
import { createAuthHandler, isAuthenticated } from "./auth/auth.js";
const handleAuth = createAuthHandler();
import { createDatabasePool } from "./database/connection.js";
import { createBooksRepository } from "./database/books-repository.js";
import { validateBook, validBookId } from "./database/book-validation.js";
import { validateSale } from "./database/sales-validation.js";
import { parseSalesCsv } from "./database/sales-csv.js";
import { inspectKdpReport } from "./database/kdp-report-inspector.js";
import { createSalesRepository } from "./database/sales-repository.js";
import { createSalesAnalyticsRepository } from "./database/sales-analytics.js";
import { createExpensesRepository } from "./database/expenses-repository.js";
import { createProfitRepository } from "./database/profit-repository.js";
import { validateExpense } from "./database/expenses-validation.js";
const booksRepository = createBooksRepository();
const salesRepository = createSalesRepository();
const salesAnalytics = createSalesAnalyticsRepository();
const expensesRepository = createExpensesRepository();
const profitRepository = createProfitRepository();

async function checkDatabaseOnStartup() {
  let pool;
  try {
    pool = createDatabasePool();
    const [rows] = await pool.query("SHOW TABLES");
    const names = new Set(rows.map(row => Object.values(row)[0]));
    const missing = ["admin_users", "books", "sales_records"].filter(name => !names.has(name));
    console.log(JSON.stringify({ level: missing.length ? "WARN" : "LOG", event: "kdp_database_check", connection: "ok", tables: missing.length ? "missing" : "ok", missing }));
  } catch (error) {
    console.error(JSON.stringify({ level: "ERROR", event: "kdp_database_check", connection: "failed", code: typeof error.code === "string" ? error.code : "CONFIGURATION_ERROR" }));
  } finally {
    if (pool) await pool.end();
  }
}


const PORT = Number(process.env.PORT || 3000);

const json = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(data));
};

const dashboard = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KDP Manager</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f6fa;color:#17233d;font:16px Arial,sans-serif}header{background:#17233d;color:white;padding:20px}header h1{margin:0 0 8px}header p{margin:0;color:#b9c6db}button{cursor:pointer;border:0;border-radius:9px;padding:10px 16px}#logout{float:right;background:#fff;color:#17233d}main{max-width:1000px;margin:auto;padding:20px}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.card{background:white;padding:20px;border-radius:12px;margin-bottom:14px;box-shadow:0 3px 14px #15213d0a}.card small{display:block;color:#64748b}.card strong{display:block;font-size:25px;margin-top:10px}.book{padding:14px 0;border-bottom:1px solid #e2e8f0}.book:last-child{border:0}.book small{margin-top:6px}#error{color:#b91c1c}.fields{display:grid;grid-template-columns:1fr;gap:12px}label{display:block;margin:10px 0;font-weight:600}input,select,textarea{display:block;width:100%;padding:11px;margin-top:6px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}.actions{display:flex;gap:10px;flex-wrap:wrap}.actions button{background:#2563eb;color:white}.actions button:disabled{opacity:.6}#form-message{min-height:20px;color:#334155}.edit-book{margin-top:8px;background:#e2e8f0}@media(min-width:700px){.fields{grid-template-columns:repeat(2,1fr)}}@media(min-width:700px){.stats{grid-template-columns:repeat(3,1fr)}}

:root{color-scheme:light;--ink:#17233d;--muted:#64748b;--line:#e2e8f0;--accent:#2563eb}html{scroll-behavior:smooth;scroll-padding-top:86px}body{line-height:1.5}header{position:sticky;top:0;z-index:10;padding:14px max(16px,calc((100vw - 1120px)/2));box-shadow:0 2px 14px #0f172a20}header h1{font-size:1.25rem;margin:0}header p{font-size:.8rem}#logout{font-weight:700;padding:8px 12px}main{max-width:1120px;padding:18px 14px 48px}.card{border:1px solid var(--line);box-shadow:0 4px 20px #15213d08;padding:18px}h2{font-size:1.18rem;margin:0 0 12px}h3{font-size:1rem}p{overflow-wrap:anywhere}.stats .card{margin-bottom:0}.stats .card strong{font-variant-numeric:tabular-nums}.workspace-nav{display:flex;gap:8px;overflow-x:auto;padding:12px 0 16px;scrollbar-width:thin}.workspace-nav a{flex:none;padding:9px 13px;background:#fff;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--ink);font-size:.9rem;font-weight:700;white-space:nowrap}.workspace-nav a:hover,.workspace-nav a:focus-visible{background:#dbeafe;border-color:#93c5fd}input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}input,select,textarea{min-height:44px;background:#fff}button{min-height:42px;font-weight:600}.actions button{background:var(--accent)}.card>p{color:#475569}.book{display:flex;flex-direction:column;align-items:flex-start;gap:6px}.edit-book{padding:8px 14px}section[id]{scroll-margin-top:92px}#error:empty{display:none}@media(min-width:700px){main{padding:24px}.card{padding:24px}.workspace-nav{gap:10px}.book{flex-direction:row;align-items:center;flex-wrap:wrap}.book strong{min-width:220px}.book small{flex:1}.edit-book{margin-top:0}}@media(max-width:420px){header{padding:12px 14px}header h1{font-size:1.1rem}.stats{gap:8px}.stats .card{padding:12px}.stats .card strong{font-size:1.5rem}main{padding:12px}.card{padding:15px}button{max-width:100%}}
</style></head><body><header><button id="logout" type="button">Sign out</button><h1>KDP Manager</h1><p>Private publishing dashboard</p></header><main><nav class="workspace-nav" aria-label="Dashboard sections"><a href="#overview">Overview</a><a href="#library">Books</a><a href="#drive">Google Drive</a><a href="#book-editor">Add / edit</a><a href="#sales">Sales</a><a href="#finance">Finances</a><a href="#analytics">Analytics</a><a href="#imports">Imports</a></nav><p id="error" role="alert"></p><div class="stats" id="overview"><div class="card"><small>Total books</small><strong id="total">—</strong></div><div class="card"><small>Published books</small><strong id="published">—</strong></div><div class="card"><small>Units sold</small><strong id="units">—</strong></div></div><section class="card"><h2>Royalties by currency</h2><div id="royalties">Loading…</div></section><section class="card" id="book-editor"><h2 id="form-heading">Add a book</h2><form id="book-form">
<input type="hidden" id="book-id">
<div class="fields">
<label>Title *<input id="book-title" maxlength="255" required></label>
<label>Subtitle<input id="book-subtitle" maxlength="255"></label>
<label>Author<input id="book-author" maxlength="255"></label>
<label>ASIN<input id="book-asin" maxlength="20"></label>
<label>ISBN<input id="book-isbn" maxlength="20"></label>
<label>Category<input id="book-category" maxlength="150"></label>
<label>Format<input id="book-format" maxlength="50" placeholder="Paperback, Kindle, Hardcover"></label>
<label>Status<select id="book-status"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
<label>Publication date<input id="book-publication_date" type="date"></label>
</div><label>Notes<textarea id="book-notes" maxlength="10000" rows="3"></textarea></label>
<div class="actions"><button id="save-book" type="submit">Save book</button><button id="cancel-edit" type="button" hidden>Cancel edit</button></div><p id="form-message" role="status"></p>
</form></section><section class="card" id="sales"><h2>Record a sale</h2><form id="sale-form"><label>Book *<select id="sale-book" required></select></label><div class="fields"><label>Sale date *<input id="sale-date" type="date" required></label><label>Units *<input id="sale-units" type="number" min="0" max="1000000" step="1" value="1" required></label><label>Royalties *<input id="sale-royalties" type="number" min="0" step="0.01" value="0.00" required></label><label>Currency *<select id="sale-currency"><option>USD</option><option>EUR</option><option>GBP</option><option>CAD</option><option>AUD</option><option>JPY</option><option>INR</option><option>BRL</option><option>MXN</option></select></label></div><div class="actions"><button type="submit" id="save-sale">Save sale</button></div><p id="sale-message" role="status"></p></form></section><section class="card" id="finance"><h2>Net profit by currency</h2><p>Royalties minus recorded expenses. Not a tax calculation. No currency conversion.</p><label>Month<input type="month" id="profit-month"></label><button type="button" id="refresh-profit">Update profit</button><div id="profit-summary" role="status">Loading…</div></section><section class="card"><h2>Record an expense</h2><p>Expense tracking requires the additive expenses database migration. No existing sales or books will be changed.</p><form id="expense-form"><div class="fields"><label>Date *<input type="date" id="expense-date" required></label><label>Book (optional)<select id="expense-book"><option value="">General expense</option></select></label><label>Category *<select id="expense-category"><option value="cover">Cover design</option><option value="editing">Editing</option><option value="advertising">Advertising</option><option value="software">Software</option><option value="formatting">Formatting</option><option value="other">Other</option></select></label><label>Amount *<input type="number" id="expense-amount" min="0.01" max="9999999999.99" step="0.01" required></label><label>Currency *<select id="expense-currency"><option>USD</option><option>EUR</option><option>GBP</option><option>CAD</option><option>AUD</option><option>JPY</option><option>INR</option><option>BRL</option><option>MXN</option></select></label></div><label>Description *<input id="expense-description" maxlength="255" required></label><div class="actions"><button type="submit" id="save-expense">Save expense</button></div><p id="expense-message" role="status"></p></form><h3>Expenses by currency</h3><div id="expenses-summary">Loading…</div><h3>Recent expenses</h3><div id="expenses-history">Loading…</div></section><section class="card" id="imports"><h2>Inspect Amazon KDP report</h2><p>Read-only inspection of CSV headers and report type. Native Amazon KDP formats cannot be imported until their mapping is verified.</p><label>Select report CSV<input id="kdp-report-file" type="file" accept=".csv,text/csv"></label><button id="inspect-report" type="button">Inspect report</button><pre id="report-inspection" style="white-space:pre-wrap;overflow-wrap:anywhere" role="status"></pre></section><section class="card"><h2>Import sales CSV</h2><p>Use a normalized CSV with columns <code>asin,sale_date,units,royalties,currency</code>. Add each book with its ASIN first. This is not a direct Amazon KDP export importer. Maximum 500 rows / 256 KB. Identical imported rows are skipped; review aggregate reports carefully.</p><label>CSV file<input type="file" id="csv-file" accept=".csv,text/csv"></label><button id="preview-csv" type="button">Preview CSV</button><p id="csv-preview" role="status"></p><button id="import-csv" type="button" disabled>Confirm import</button></section><section class="card" id="analytics"><h2>Sales analytics filters</h2><div class="fields"><label>Month<select id="analytics-month"><option value="">All months</option></select></label><label>Book<select id="analytics-book"><option value="">All books</option></select></label></div><p>Amounts remain separated by currency. Aggregations are calculated in MySQL across all matching sales records.</p></section><section class="card"><h2>Compare two months</h2><div class="fields"><label>First month<input type="month" id="compare-first"></label><label>Second month<input type="month" id="compare-second"></label></div><button type="button" id="compare-months">Compare months</button><div id="comparison-result" aria-live="polite">Choose two months to compare.</div></section><section class="card"><h2>Monthly sales</h2><div id="monthly-sales">Loading…</div></section><section class="card"><h2>Sales by book</h2><div id="book-sales">Loading…</div></section><section class="card"><h2>Sales history</h2><div id="sales-history">Loading…</div></section><section class="card" id="drive"><h2>Google Drive library</h2><p><strong>Source folder:</strong> Bees · Read-only connection</p><p><a href="https://drive.google.com/drive/folders/1KmoF4y_IJefqth3TXSb0WKwE1yfftwsx" target="_blank" rel="noopener noreferrer">Open source folder</a></p><p id="drive-connection" role="status">Checking Google Drive connection…</p><div class="actions"><button id="drive-refresh" type="button">Refresh files</button><a id="drive-connect" href="/auth/google/start" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Connect Google Drive</a></div><p id="drive-count" role="status"></p><div id="drive-list"></div><div id="drive-match-preview" role="status"></div><p><small>Files are listed directly from Google Drive. Nothing is imported into MySQL automatically. Connection persistence depends on encrypted storage configuration.</small></p></section><section class="card" id="library"><h2>My Books</h2><p>Manage unpublished drafts and published KDP titles in one library. Google Drive sync is not connected yet.</p><label>Show books<select id="books-filter"><option value="all">All books</option><option value="draft">Unpublished drafts</option><option value="published">Published books</option><option value="archived">Archived books</option></select></label><p id="books-count" role="status"></p><div id="books">Loading…</div></section><p>Data is read from your KDP Manager database. Amazon KDP is not connected; sales must be imported or entered separately.</p></main><script>
let loadedBooks=[];let loadedSales=[];
async function loadDrive(){
  const status=document.getElementById("drive-connection"), list=document.getElementById("drive-list"), count=document.getElementById("drive-count");
  const refresh=document.getElementById("drive-refresh");
  refresh.disabled=true;status.textContent="Checking Google Drive…";count.textContent="";list.replaceChildren();
  try{
    const response=await fetch("/api/drive/status",{cache:"no-store"});
    if(!response.ok)throw new Error("Unable to check connection");
    const state=await response.json();
    if(!state.connected){status.textContent="Not connected. Select Connect Google Drive to authorize read-only access.";return;}
    status.textContent=state.persistence==="encrypted-mysql-if-migrated"?"Connected (read-only). Encrypted storage configured.":"Connected (read-only). Authorization is held in server memory only.";
    const filesResponse=await fetch("/api/drive/files",{cache:"no-store"});
    if(!filesResponse.ok)throw new Error("Could not load Drive files. Reconnect if authorization expired.");
    const data=await filesResponse.json(),files=Array.isArray(data.files)?data.files:[];
    count.textContent=files.length+" file(s) found"+(data.truncated?" (additional files not shown)":"");
    if(!files.length){list.textContent="This folder is empty.";document.getElementById("drive-match-preview").textContent="No files to match.";return;}
    const preview=document.getElementById("drive-match-preview");
    preview.textContent="Comparing Drive filenames with existing book titles…";
    let books=[];
    try{
      const booksResponse=await fetch("/books",{cache:"no-store"});
      if(!booksResponse.ok)throw Error("Book list unavailable");
      const payload=await booksResponse.json();
      books=Array.isArray(payload.books)?payload.books:[];
    }catch{preview.textContent="Could not compare with MySQL books. Drive files remain accessible; match status is unknown."; }
    const normalized=value=>String(value||"").normalize("NFKC").toLowerCase().replace(/\\.(docx?|pdf|epub)$/i,"").replace(/[^\\p{L}\\p{N}]+/gu," ").trim().replace(/\\s+/g," ");
    const byTitle=new Map();
    if(books.length){
      for(const book of books){const key=normalized(book.title);if(!key)continue;const entries=byTitle.get(key)||[];entries.push(book);byTitle.set(key,entries);}
      let matched=0,ambiguous=0;
      for(const file of files){const candidates=byTitle.get(normalized(file.name))||[];if(candidates.length===1)matched++;else if(candidates.length>1)ambiguous++;}
      preview.textContent="Title comparison (preview only): "+matched+" unique exact matches, "+ambiguous+" ambiguous, "+(files.length-matched-ambiguous)+" unmatched. No records changed.";
    }else if(!preview.textContent.startsWith("Could not"))preview.textContent="No MySQL books available for comparison. No records changed.";
    for(const file of files){
      const item=document.createElement("div");item.className="book";
      const name=document.createElement("strong");name.textContent=file.name||"Untitled file";item.appendChild(name);
      const matches=byTitle.get(normalized(file.name))||[];
      const matchLabel=document.createElement("small");
      matchLabel.textContent=preview.textContent.startsWith("Could not compare")?"Match status unavailable":matches.length===1?"Exact title match: "+matches[0].title+" (book #"+matches[0].id+")":matches.length>1?"Ambiguous: "+matches.length+" books have this title":"No exact book title match";
      item.appendChild(matchLabel);
      const picker=document.createElement("select");
      picker.setAttribute("aria-label","Choose a book for "+(file.name||"Drive file"));
      const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="Select book to link (preview)";picker.appendChild(placeholder);
      for(const book of books){const option=document.createElement("option");option.value=book.id;option.textContent=book.title+" (#"+book.id+")";picker.appendChild(option);}
      if(matches.length===1)picker.value=matches[0].id;
      const selection=document.createElement("small");
      selection.textContent="Choose a book to review the association. No link is saved.";
      picker.addEventListener("change",()=>{const chosen=books.find(book=>book.id===picker.value);selection.textContent=chosen?"Proposed link: "+file.name+" → "+chosen.title+" (#"+chosen.id+"). Awaiting secure server-side linking.":"No book selected.";});
      item.appendChild(picker);item.appendChild(selection);
      const linkButton=document.createElement("button");
      linkButton.type="button";linkButton.textContent="Link selected book";
      linkButton.disabled=!books.length;
      linkButton.addEventListener("click",async()=>{
        if(!picker.value)return void(selection.textContent="Choose a book first.");
        const chosen=books.find(book=>book.id===picker.value);
        if(!chosen||!window.confirm("Link "+file.name+" to "+chosen.title+"? This will save an association in MySQL."))return;
        linkButton.disabled=true;selection.textContent="Saving association…";
        try{
          const response=await fetch("/api/drive/book-links",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bookId:chosen.id,fileId:file.id,confirm:true})});
          const result=await response.json();
          if(!response.ok)throw Error(result.error||"Link failed");
          selection.textContent=result.alreadyLinked?"This file is already linked to the selected book.":"Linked successfully to "+chosen.title;
        }catch(error){selection.textContent=error.message||"Unable to save link";linkButton.disabled=false;}
      });
      item.appendChild(linkButton);
      const meta=document.createElement("small");const date=file.modifiedTime?new Date(file.modifiedTime):null;
      meta.textContent=(date&&!Number.isNaN(date.valueOf())?"Modified: "+date.toLocaleDateString():"Modified date unavailable")+(file.size?" · "+Math.round(Number(file.size)/1024)+" KB":"");item.appendChild(meta);
      if(typeof file.webViewLink==="string"&&file.webViewLink.startsWith("https://")){
        const link=document.createElement("a");link.href=file.webViewLink;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open in Google Drive";item.appendChild(link);
      }
      list.appendChild(item);
    }
  }catch(error){status.textContent=error.message||"Google Drive request failed.";}
  finally{refresh.disabled=false;}
}
document.getElementById("drive-refresh").addEventListener("click",loadDrive);
// Native link works even if dashboard JavaScript fails or loads slowly.
loadDrive();
async function loadProfit(){const target=document.getElementById("profit-summary"),month=document.getElementById("profit-month").value;target.textContent="Loading…";try{const response=await fetch("/api/profit"+(month?"?month="+encodeURIComponent(month):""),{cache:"no-store"});if(response.status===401){location.assign("/login");return}const data=await response.json();if(!response.ok)throw Error(data.error||"Profit unavailable");if(month!==document.getElementById("profit-month").value)return;target.replaceChildren();if(!data.totals.length)target.textContent="No recorded royalties or expenses.";for(const item of data.totals){const p=document.createElement("p");p.textContent=item.currency+" · Royalties "+item.royalties+" − Expenses "+item.expenses+" = Net "+item.net_profit;target.append(p)}}catch(error){target.textContent=error.message}}
document.getElementById("refresh-profit").addEventListener("click",loadProfit);
async function loadExpenses(){const summary=document.getElementById("expenses-summary"),history=document.getElementById("expenses-history");try{const response=await fetch("/api/expenses",{cache:"no-store"});if(response.status===401){location.assign("/login");return}const data=await response.json();if(!response.ok)throw Error(data.error||"Expenses unavailable");summary.replaceChildren();history.replaceChildren();if(!data.expensesByCurrency.length)summary.textContent="No expenses yet.";for(const row of data.expensesByCurrency){const p=document.createElement("p");p.textContent=row.expenses+" "+row.currency;summary.append(p)}if(!data.expenses.length)history.textContent="No expenses yet.";for(const row of data.expenses){const p=document.createElement("p");p.textContent=row.expense_date+" · "+row.description+" · "+row.amount+" "+row.currency+(row.book_title?" · "+row.book_title:"");history.append(p)}}catch(error){summary.textContent=error.message;history.textContent="Expense history unavailable."}}
document.getElementById("expense-form").addEventListener("submit",async event=>{event.preventDefault();const button=document.getElementById("save-expense"),message=document.getElementById("expense-message");button.disabled=true;message.textContent="Saving…";try{const payload={expense_date:document.getElementById("expense-date").value,book_id:document.getElementById("expense-book").value||null,category:document.getElementById("expense-category").value,description:document.getElementById("expense-description").value,amount:document.getElementById("expense-amount").value,currency:document.getElementById("expense-currency").value};const response=await fetch("/api/expenses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});if(response.status===401){location.assign("/login");return}const data=await response.json();if(!response.ok)throw Error(data.error||"Unable to save expense");message.textContent="Expense saved.";document.getElementById("expense-amount").value="";document.getElementById("expense-description").value="";await loadExpenses();await loadProfit()}catch(error){message.textContent=error.message}finally{button.disabled=false}});

const filteredSales=()=>loadedSales.filter(s=>(!document.getElementById("analytics-month").value||String(s.sale_date).slice(0,7)===document.getElementById("analytics-month").value)&&(!document.getElementById("analytics-book").value||String(s.book_id)===document.getElementById("analytics-book").value));
async function drawFilteredAnalytics(){const month=document.getElementById("analytics-month").value,book=document.getElementById("analytics-book").value;try{const query=new URLSearchParams();if(month)query.set("month",month);if(book)query.set("book_id",book);const response=await fetch("/api/analytics?"+query.toString(),{cache:"no-store"});if(response.status===401){location.assign("/login");return}if(!response.ok)throw Error("Analytics unavailable");const data=await response.json();if(month!==document.getElementById("analytics-month").value||book!==document.getElementById("analytics-book").value)return;for(const [id,rows,format] of [["monthly-sales",data.monthly,r=>r.month+" · "+r.units+" units · "+r.royalties+" "+r.currency],["book-sales",data.byBook,r=>r.book_title+" · "+r.units+" units · "+r.royalties+" "+r.currency]]){const el=document.getElementById(id);el.replaceChildren();if(!rows.length)el.textContent="No sales for this selection.";for(const row of rows){const p=document.createElement("p");p.textContent=format(row);el.append(p)}}}catch{put("monthly-sales","Unable to load analytics");put("book-sales","Unable to load analytics")}}
function refreshAnalyticsFilters(){const month=document.getElementById("analytics-month"),book=document.getElementById("analytics-book"),prevMonth=month.value,prevBook=book.value;month.replaceChildren();book.replaceChildren();for(const [el,label] of [[month,"All months"],[book,"All books"]]){const option=document.createElement("option");option.value="";option.textContent=label;el.append(option)}const months=[...new Set(loadedSales.map(s=>String(s.sale_date).slice(0,7)))].sort().reverse();for(const value of months){const option=document.createElement("option");option.value=value;option.textContent=value;month.append(option)}for(const b of loadedBooks){const option=document.createElement("option");option.value=b.id;option.textContent=b.title;book.append(option)}if(months.includes(prevMonth))month.value=prevMonth;if(loadedBooks.some(b=>b.id===prevBook))book.value=prevBook;drawFilteredAnalytics()}
document.getElementById("compare-months").addEventListener("click",async()=>{const first=document.getElementById("compare-first").value,second=document.getElementById("compare-second").value,target=document.getElementById("comparison-result");if(!first||!second){target.textContent="Select both months.";return}target.textContent="Loading comparison…";try{const responses=await Promise.all([first,second].map(month=>fetch("/api/analytics?month="+encodeURIComponent(month),{cache:"no-store"})));if(responses.some(r=>r.status===401)){location.assign("/login");return}if(responses.some(r=>!r.ok))throw Error("Request failed");const data=await Promise.all(responses.map(r=>r.json()));const totals=data.map(d=>{const result=new Map();for(const row of d.monthly){const old=result.get(row.currency)||{units:0,royalties:0};old.units+=Number(row.units);old.royalties+=Number(row.royalties);result.set(row.currency,old)}return result});target.replaceChildren();const currencies=[...new Set([...totals[0].keys(),...totals[1].keys()])].sort();if(!currencies.length){target.textContent="No sales for either month.";return}for(const currency of currencies){const a=totals[0].get(currency)||{units:0,royalties:0},b=totals[1].get(currency)||{units:0,royalties:0};const p=document.createElement("p");p.textContent=currency+": "+first+" — "+a.units+" units, "+a.royalties.toFixed(2)+"; "+second+" — "+b.units+" units, "+b.royalties.toFixed(2)+"; change "+(b.units-a.units)+" units, "+(b.royalties-a.royalties).toFixed(2)+" "+currency;p.dataset.currency=currency;target.append(p)}}catch{target.textContent="Unable to compare months."}});
document.getElementById("analytics-month").addEventListener("change",drawFilteredAnalytics);document.getElementById("analytics-book").addEventListener("change",drawFilteredAnalytics);
const put=(id,value)=>{document.getElementById(id).textContent=String(value)};
async function load(){try{const [a,b,c,d]=await Promise.all([fetch("/books",{cache:"no-store"}),fetch("/api/summary",{cache:"no-store"}),fetch("/api/sales",{cache:"no-store"}),fetch("/api/analytics",{cache:"no-store"})]);if(a.status===401||b.status===401||c.status===401||d.status===401){location.assign("/login");return}if(!a.ok||!b.ok||!c.ok||!d.ok)throw Error("Data unavailable");const books=(await a.json()).books,summary=await b.json(),sales=(await c.json()).sales,analytics=await d.json();loadedBooks=books;loadedSales=sales;const expenseBook=document.getElementById("expense-book");expenseBook.replaceChildren();const general=document.createElement("option");general.value="";general.textContent="General expense";expenseBook.append(general);for(const book of books){const option=document.createElement("option");option.value=book.id;option.textContent=book.title;expenseBook.append(option)}void loadExpenses();void loadProfit();refreshAnalyticsFilters();const options=document.getElementById("sale-book");const selected=options.value;options.replaceChildren();for(const book of books){const option=document.createElement("option");option.value=book.id;option.textContent=book.title;options.append(option)}if(books.some(b=>b.id===selected))options.value=selected;const history=document.getElementById("sales-history");history.replaceChildren();if(!sales.length)history.textContent="No sales recorded yet.";for(const sale of sales){const p=document.createElement("p");p.textContent=[String(sale.sale_date).slice(0,10),sale.book_title,sale.units+" units",sale.royalties+" "+sale.currency].join(" · ");history.append(p)}put("total",summary.totalBooks);put("published",summary.publishedBooks);put("units",summary.unitsSold);const royalties=document.getElementById("royalties");royalties.replaceChildren();if(!summary.royaltiesByCurrency.length)royalties.textContent="No sales records yet.";for(const row of summary.royaltiesByCurrency){const p=document.createElement("p");p.textContent=row.currency+": "+row.royalties+" ("+row.units+" units)";royalties.append(p)}renderBookList()}catch{put("error","Unable to load your data. Please try again later.");const booksPanel=document.getElementById("books");if(booksPanel)booksPanel.textContent="Books could not be loaded. Refresh the page to retry.";const history=document.getElementById("sales-history");if(history)history.textContent="Sales could not be loaded."}}
function renderBookList(){const list=document.getElementById("books"),filter=document.getElementById("books-filter").value;list.replaceChildren();const books=loadedBooks.filter(book=>filter==="all"||book.status===filter);document.getElementById("books-count").textContent=books.length+" of "+loadedBooks.length+" books";if(!books.length){list.textContent=loadedBooks.length?"No books in this category.":"No books added yet. Add a draft or a published book above.";return}for(const book of books){const item=document.createElement("div");item.className="book";const title=document.createElement("strong");title.textContent=book.title;const detail=document.createElement("small");detail.textContent=[book.author,book.category,book.status==="draft"?"Unpublished":book.status==="published"?"Published":"Archived"].filter(Boolean).join(" · ");const edit=document.createElement("button");edit.type="button";edit.className="edit-book";edit.textContent="Edit";edit.addEventListener("click",()=>editBook(book));item.append(title,detail,edit);list.append(item)}}
document.getElementById("books-filter").addEventListener("change",renderBookList);
const bookFields=["title","subtitle","author","asin","isbn","category","format","status","publication_date","notes"];
function resetForm(){document.getElementById("book-form").reset();put("book-id","");document.getElementById("book-id").value="";put("form-heading","Add a book");document.getElementById("cancel-edit").hidden=true;put("form-message","")}
function editBook(book){document.getElementById("book-id").value=book.id;for(const key of bookFields){let value=book[key]??"";if(key==="publication_date"&&value)value=String(value).slice(0,10);document.getElementById("book-"+key).value=value}put("form-heading","Edit book");document.getElementById("cancel-edit").hidden=false;put("form-message","");document.getElementById("book-form").scrollIntoView({behavior:"smooth"})}
document.getElementById("cancel-edit").addEventListener("click",resetForm);
document.getElementById("book-form").addEventListener("submit",async e=>{e.preventDefault();const id=document.getElementById("book-id").value;const payload={};for(const key of bookFields)payload[key]=document.getElementById("book-"+key).value;const save=document.getElementById("save-book");save.disabled=true;put("form-message","Saving…");try{const response=await fetch(id?"/api/books/"+encodeURIComponent(id):"/api/books",{method:id?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});if(response.status===401){location.assign("/login");return}const data=await response.json();if(!response.ok){put("form-message",data.error||"Unable to save book");return}resetForm();put("form-message",id?"Book updated successfully.":"Book added successfully.");await load()}catch{put("form-message","Connection error. Please retry.")}finally{save.disabled=false}});
document.getElementById("sale-date").value=new Date().toLocaleDateString("en-CA");
document.getElementById("sale-form").addEventListener("submit",async e=>{e.preventDefault();const button=document.getElementById("save-sale");button.disabled=true;put("sale-message","Saving…");try{const payload={book_id:document.getElementById("sale-book").value,sale_date:document.getElementById("sale-date").value,units:Number(document.getElementById("sale-units").value),royalties:document.getElementById("sale-royalties").value,currency:document.getElementById("sale-currency").value};const r=await fetch("/api/sales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});if(r.status===401){location.assign("/login");return}const data=await r.json();if(!r.ok){put("sale-message",data.error||"Unable to save sale");return}put("sale-message","Sale recorded.");await load()}catch{put("sale-message","Connection error. Please retry.")}finally{button.disabled=false}});
document.getElementById("inspect-report").addEventListener("click",async()=>{
 const file=document.getElementById("kdp-report-file").files[0];
 if(!file||file.size>262144){put("report-inspection","Select a CSV up to 256 KB.");return}
 put("report-inspection","Inspecting…");
 try{
   const r=await fetch("/api/reports/inspect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({csv:await file.text()})});
   if(r.status===401){location.assign("/login");return}
   const data=await r.json();
   put("report-inspection",r.ok?JSON.stringify(data,null,2):data.error||"Inspection failed");
 }catch{put("report-inspection","Unable to inspect report")}
});
let pendingCsv="";
document.getElementById("preview-csv").addEventListener("click",async()=>{
  const file=document.getElementById("csv-file").files[0];
  const confirm=document.getElementById("import-csv");
  confirm.disabled=true;pendingCsv="";
  if(!file||file.size>262144){put("csv-preview","Select a CSV file up to 256 KB.");return}
  const csv=await file.text();
  const lines=csv.trim().split(/\r?\n/);
  if(lines.length<2||lines.length>501||lines[0].replace(/^\uFEFF/,"").trim().toLowerCase()!=="asin,sale_date,units,royalties,currency"){put("csv-preview","Expected header: asin,sale_date,units,royalties,currency; 1–500 rows.");return}
  pendingCsv=csv;
  put("csv-preview",String(lines.length-1)+" data rows detected. Server will validate ASINs, dates, amounts and duplicates before saving. Confirm only after reviewing the source.");
  confirm.disabled=false;
});
document.getElementById("csv-file").addEventListener("change",()=>{pendingCsv="";document.getElementById("import-csv").disabled=true;put("csv-preview","")});
document.getElementById("import-csv").addEventListener("click",async()=>{
  if(!pendingCsv)return;
  const button=document.getElementById("import-csv");button.disabled=true;
  put("csv-preview","Importing…");
  try {
    const r=await fetch("/api/sales/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({csv:pendingCsv})});
    if(r.status===401){location.assign("/login");return}
    const data=await r.json();
    if(!r.ok){put("csv-preview",data.error||"Import failed");return}
    put("csv-preview",data.inserted+" rows imported; "+data.skipped+" duplicates skipped.");
    pendingCsv="";await load();
  }catch{put("csv-preview","Import failed. Please retry after checking sales history.")}
});
document.getElementById("logout").addEventListener("click",async()=>{await fetch("/api/auth/logout",{method:"POST"});location.assign("/login")});load();
</script></body></html>`;

const loginPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in — KDP Manager</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f6fa;color:#17233d;font:16px Arial,sans-serif}main{width:min(92vw,410px);background:white;padding:28px;border-radius:16px;box-shadow:0 6px 28px #17233d16}h1{margin-top:0}label{display:block;margin:16px 0}input{display:block;width:100%;padding:13px;margin-top:7px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}button{width:100%;padding:13px;border:0;border-radius:8px;background:#1d4ed8;color:white;font:inherit;cursor:pointer}button:disabled{opacity:.6}#error{color:#b91c1c;min-height:22px}
</style></head><body><main><h1>KDP Manager</h1><p>Administrator sign in</p><form id="login-form"><label>Username<input id="username" autocomplete="username" required maxlength="100"></label><label>Password<input id="password" type="password" autocomplete="current-password" required></label><button id="submit" type="submit">Sign in</button><p id="error" role="alert"></p></form></main><script>
document.getElementById("login-form").addEventListener("submit",async event=>{event.preventDefault();const button=document.getElementById("submit"),error=document.getElementById("error");button.disabled=true;error.textContent="";try{const response=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:document.getElementById("username").value,password:document.getElementById("password").value})});if(!response.ok){error.textContent=response.status===429?"Too many attempts. Try again later.":"Invalid credentials or service unavailable.";return}location.assign("/")}catch{error.textContent="Connection error. Please retry."}finally{button.disabled=false}});
</script></body></html>`;

export const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (await handleAuth(req, res, path)) return;
  if (await handleGoogleDrive(req, res, path)) return;
  if (path === "/login" && req.method === "GET") {
    if (isAuthenticated(req)) { res.writeHead(302, { Location: "/", "Cache-Control": "no-store" }); res.end(); return; }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(loginPage); return;
  }
  if (path === "/" && !isAuthenticated(req)) { res.writeHead(302, { Location: "/login", "Cache-Control": "no-store" }); res.end(); return; }
  if (path === "/books" && !isAuthenticated(req)) {
    json(res, 401, { error: "Authentication required" });
    return;
  }
  const bookId = /^\/api\/books\/([^/]+)$/.exec(path)?.[1];
  if ((path === "/api/books" && req.method === "POST") || (bookId && req.method === "PUT")) {
    if (!isAuthenticated(req)) { json(res, 401, { error: "Authentication required" }); return; }
    const origin = req.headers.origin;
    if (origin) {
      let valid = false;
      try { const url = new URL(origin); valid = url.protocol === "https:" && url.host === req.headers.host; } catch {}
      if (!valid) { json(res, 403, { error: "Forbidden" }); return; }
    }
    if (!(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) { json(res, 415, { error: "JSON required" }); return; }
    if (bookId && !validBookId(bookId)) { json(res, 400, { error: "Invalid book ID" }); return; }
    let raw = "";
    try {
      for await (const chunk of req) {
        raw += chunk.toString();
        if (Buffer.byteLength(raw) > 16384) { json(res, 413, { error: "Request too large" }); return; }
      }
      const { book, error } = validateBook(JSON.parse(raw));
      if (error) { json(res, 400, { error }); return; }
      if (bookId) {
        const updated = await booksRepository.update(bookId, book);
        json(res, updated ? 200 : 404, updated ? { ok: true } : { error: "Book not found" });
      } else {
        const created = await booksRepository.create(book);
        json(res, 201, created);
      }
    } catch (error) {
      if (error instanceof SyntaxError) json(res, 400, { error: "Invalid JSON" });
      else { console.error(JSON.stringify({ event: "book_write_failed", code: error.code || "DB_ERROR" })); json(res, 503, { error: "Unable to save book" }); }
    }
    return;
  }
  if (path === "/api/sales" && req.method === "POST") {
    if (!isAuthenticated(req)) { json(res, 401, { error: "Authentication required" }); return; }
    const origin = req.headers.origin;
    if (origin) {
      let valid = false;
      try { const url = new URL(origin); valid = url.protocol === "https:" && url.host === req.headers.host; } catch {}
      if (!valid) { json(res, 403, { error: "Forbidden" }); return; }
    }
    if (!(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) { json(res, 415, { error: "JSON required" }); return; }
    let raw = "";
    try {
      for await (const chunk of req) {
        raw += chunk.toString();
        if (Buffer.byteLength(raw) > 4096) { json(res, 413, { error: "Request too large" }); return; }
      }
      const { sale, error } = validateSale(JSON.parse(raw));
      if (error) { json(res, 400, { error }); return; }
      const created = await salesRepository.create(sale);
      json(res, created ? 201 : 404, created || { error: "Book not found" });
    } catch (error) {
      if (error instanceof SyntaxError) json(res, 400, { error: "Invalid JSON" });
      else { console.error(JSON.stringify({ event: "sale_write_failed", code: error.code || "DB_ERROR" })); json(res, 503, { error: "Unable to save sale" }); }
    }
    return;
  }
  if (path === "/api/reports/inspect" && req.method === "POST") {
    if (!isAuthenticated(req)) { json(res, 401, { error: "Authentication required" }); return; }
    const origin = req.headers.origin;
    if (origin) {
      let valid = false;
      try { const url = new URL(origin); valid = url.protocol === "https:" && url.host === req.headers.host; } catch {}
      if (!valid) { json(res, 403, { error: "Forbidden" }); return; }
    }
    if (!(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) { json(res, 415, { error: "JSON required" }); return; }
    let raw="";
    try {
      for await (const chunk of req) {
        raw+=chunk.toString();
        if(Buffer.byteLength(raw)>300000){json(res,413,{error:"Request too large"});return}
      }
      const result=inspectKdpReport(JSON.parse(raw)?.csv);
      json(res,result.error?400:200,result);
    } catch(error) {
      if(error instanceof SyntaxError)json(res,400,{error:"Invalid JSON"});
      else json(res,503,{error:"Report inspection failed"});
    }
    return;
  }
  if (path === "/api/sales/import" && req.method === "POST") {
    if (!isAuthenticated(req)) { json(res, 401, { error: "Authentication required" }); return; }
    const origin = req.headers.origin;
    if (origin) {
      let valid = false;
      try { const url = new URL(origin); valid = url.protocol === "https:" && url.host === req.headers.host; } catch {}
      if (!valid) { json(res, 403, { error: "Forbidden" }); return; }
    }
    if (!(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) { json(res, 415, { error: "JSON required" }); return; }
    let raw = "";
    try {
      for await (const chunk of req) {
        raw += chunk.toString();
        if (Buffer.byteLength(raw) > 300000) { json(res, 413, { error: "Request too large" }); return; }
      }
      const csv = JSON.parse(raw)?.csv;
      const books = await booksRepository.list();
      const { sales, error } = parseSalesCsv(csv, books);
      if (error) { json(res, 400, { error }); return; }
      const result = await salesRepository.importCsv(sales);
      json(res, 200, result);
    } catch (error) {
      if (error instanceof SyntaxError) json(res, 400, { error: "Invalid JSON" });
      else { console.error(JSON.stringify({ event: "csv_import_failed", code: error.code || "DB_ERROR" })); json(res, 503, { error: "Unable to import CSV" }); }
    }
    return;
  }
  if (path === "/api/expenses" && req.method === "POST") {
    if (!isAuthenticated(req)) { json(res, 401, { error: "Authentication required" }); return; }
    const origin = req.headers.origin;
    if (origin) {
      let valid = false;
      try { const url = new URL(origin); valid = url.protocol === "https:" && url.host === req.headers.host; } catch {}
      if (!valid) { json(res, 403, { error: "Forbidden" }); return; }
    }
    if (!(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) { json(res, 415, { error: "JSON required" }); return; }
    let raw = "";
    try {
      for await (const chunk of req) {
        raw += chunk.toString();
        if (Buffer.byteLength(raw) > 12000) { json(res, 413, { error: "Request too large" }); return; }
      }
      const result = validateExpense(JSON.parse(raw));
      if (result.error) { json(res, 400, { error: result.error }); return; }
      const created = await expensesRepository.create(result.value);
      json(res, 201, created);
    } catch (error) {
      if (error instanceof SyntaxError) json(res, 400, { error: "Invalid JSON" });
      else if (error.code === "ER_NO_SUCH_TABLE") json(res, 503, { error: "Expenses database migration required" });
      else if (error.code === "ER_NO_REFERENCED_ROW_2") json(res, 400, { error: "Book not found" });
      else { console.error(JSON.stringify({ event: "expense_write_failed", code: error.code || "DB_ERROR" })); json(res, 503, { error: "Unable to save expense" }); }
    }
    return;
  }
  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  if (path === "/health") {
    json(res, 200, {
      status: "ok",
      application: "KDP Manager",
      version: "0.3.0"
    });
    return;
  }

  if (path === "/api/drive/book-links" && req.method === "POST") {
    if (!isAuthenticated(req)) { json(res, 401, { error: "Authentication required" }); return; }
    const origin = req.headers.origin;
    if (origin !== "https://" + req.headers.host) { json(res, 403, { error: "Forbidden origin" }); return; }
    if (!(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) { json(res, 415, { error: "JSON required" }); return; }
    let raw = "";
    try {
      for await (const chunk of req) {
        raw += chunk.toString();
        if (Buffer.byteLength(raw) > 4096) { json(res, 413, { error: "Request too large" }); return; }
      }
      const body = JSON.parse(raw);
      if (!body || !validBookId(String(body.bookId || "")) || !/^[a-zA-Z0-9_-]{10,255}$/.test(body.fileId || "") || body.confirm !== true) {
        json(res, 400, { error: "Valid book, file and confirmation required" }); return;
      }
      const file = await verifyDriveFile(body.fileId);
      if (!file) { json(res, 422, { error: "File not found in authorized Drive folder" }); return; }
      const result = await saveDriveLink(String(body.bookId), file);
      json(res, result.status || 200, result);
    } catch (error) {
      console.error(JSON.stringify({ event: "drive_link_failed", code: error.code || "LINK_ERROR" }));
      json(res, 503, { error: error.code === "ER_NO_SUCH_TABLE" ? "Drive links migration required" : "Could not save Drive link" });
    }
    return;
  }
  if (path === "/api/drive/book-links" && req.method === "GET") {
    if (!isAuthenticated(req)) { json(res, 401, { error: "Authentication required" }); return; }
    try { json(res, 200, { links: await listDriveLinks(), readOnly: true }); }
    catch (error) {
      const missing = error.code === "ER_NO_SUCH_TABLE";
      json(res, 503, { error: missing ? "Drive links migration required" : "Drive links temporarily unavailable" });
    }
    return;
  }
  if (path === "/books") {
    if (!isAuthenticated(req)) { json(res, 401, { error: "Authentication required" }); return; }
    try { json(res, 200, { books: await booksRepository.list(), demo: false }); }
    catch (error) { console.error(JSON.stringify({ event: "books_read_failed", code: error.code || "DB_ERROR" })); json(res, 503, { error: "Books temporarily unavailable" }); }
    return;
  }
  if (path === "/api/profit") {
    if (!isAuthenticated(req)) { json(res, 401, { error: "Authentication required" }); return; }
    const month = new URL(req.url, "http://localhost").searchParams.get("month") || "";
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) { json(res, 400, { error: "Invalid month" }); return; }
    try { json(res, 200, { month: month || null, totals: await profitRepository.summary({ month }) }); }
    catch (error) { json(res, 503, { error: error.code === "ER_NO_SUCH_TABLE" ? "Expenses database migration required" : "Profit temporarily unavailable" }); }
    return;
  }
  if (path === "/api/expenses") {
    if (!isAuthenticated(req)) { json(res, 401, { error: "Authentication required" }); return; }
    try { json(res, 200, { expenses: await expensesRepository.list(), expensesByCurrency: await expensesRepository.summary() }); }
    catch (error) { json(res, 503, { error: error.code === "ER_NO_SUCH_TABLE" ? "Expenses database migration required" : "Expenses temporarily unavailable" }); }
    return;
  }
  if (path === "/api/sales") {
    if (!isAuthenticated(req)) { json(res, 401, { error: "Authentication required" }); return; }
    try { json(res, 200, { sales: await salesRepository.list() }); }
    catch (error) { console.error(JSON.stringify({ event: "sales_read_failed", code: error.code || "DB_ERROR" })); json(res, 503, { error: "Sales temporarily unavailable" }); }
    return;
  }
  if (path === "/api/analytics") {
    if (!isAuthenticated(req)) { json(res, 401, { error: "Authentication required" }); return; }
    try { const query = new URL(req.url, "http://localhost").searchParams; const month = query.get("month") || ""; const bookId = query.get("book_id") || ""; if ((month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) || (bookId && !/^[1-9]\d{0,18}$/.test(bookId))) { json(res, 400, { error: "Invalid analytics filters" }); return; } json(res, 200, await salesAnalytics.filtered({ month, bookId })); }
    catch (error) { console.error(JSON.stringify({ event: "sales_analytics_failed", code: error.code || "DB_ERROR" })); json(res, 503, { error: "Analytics temporarily unavailable" }); }
    return;
  }
  if (path === "/api/system-status") {
    if (!isAuthenticated(req)) { json(res, 401, { error: "Authentication required" }); return; }
    let pool;
    try {
      pool = createDatabasePool();
      const [rows] = await pool.query("SHOW TABLES");
      const tables = new Set(rows.map(row => Object.values(row)[0]));
      json(res, 200, {
        database: "connected",
        requiredTables: {
          admin_users: tables.has("admin_users"),
          books: tables.has("books"),
          sales_records: tables.has("sales_records"),
          expenses: tables.has("expenses"),
          drive_book_files: tables.has("drive_book_files")
        },
        integrations: { googleDrive: "not_connected", amazonKdpDirect: "not_connected" }
      });
    } catch (error) {
      console.error(JSON.stringify({ event: "system_status_failed", code: error.code || "DB_ERROR" }));
      json(res, 503, { database: "unavailable", error: "Database status temporarily unavailable" });
    } finally {
      if (pool) await pool.end();
    }
    return;
  }
  if (path === "/api/summary") {
    if (!isAuthenticated(req)) { json(res, 401, { error: "Authentication required" }); return; }
    try { json(res, 200, { ...(await booksRepository.summary()), royaltiesByCurrency: await booksRepository.salesSummary() }); }
    catch (error) { console.error(JSON.stringify({ event: "summary_read_failed", code: error.code || "DB_ERROR" })); json(res, 503, { error: "Summary temporarily unavailable" }); }
    return;
  }

  if (path === "/") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(dashboard);
    return;
  }

  json(res, 404, { error: "Not found" });
});

if (process.env.NODE_ENV !== "test") {
  void checkDatabaseOnStartup();
  server.listen(PORT, "0.0.0.0", () => {
    console.log("KDP Manager running on port " + PORT);
  });
}

