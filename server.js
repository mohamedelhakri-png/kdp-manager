
import http from "node:http";
import { createAuthHandler, isAuthenticated } from "./auth/auth.js";
const handleAuth = createAuthHandler();
import { createDatabasePool } from "./database/connection.js";
import { createBooksRepository } from "./database/books-repository.js";
const booksRepository = createBooksRepository();

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
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(data));
};

const dashboard = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KDP Manager</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f6fa;color:#17233d;font:16px Arial,sans-serif}header{background:#17233d;color:white;padding:20px}header h1{margin:0 0 8px}header p{margin:0;color:#b9c6db}button{cursor:pointer;border:0;border-radius:9px;padding:10px 16px}#logout{float:right;background:#fff;color:#17233d}main{max-width:1000px;margin:auto;padding:20px}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.card{background:white;padding:20px;border-radius:12px;margin-bottom:14px;box-shadow:0 3px 14px #15213d0a}.card small{display:block;color:#64748b}.card strong{display:block;font-size:25px;margin-top:10px}.book{padding:14px 0;border-bottom:1px solid #e2e8f0}.book:last-child{border:0}.book small{margin-top:6px}#error{color:#b91c1c}@media(min-width:700px){.stats{grid-template-columns:repeat(3,1fr)}}
</style></head><body><header><button id="logout" type="button">Sign out</button><h1>KDP Manager</h1><p>Private publishing dashboard</p></header><main><p id="error" role="alert"></p><div class="stats"><div class="card"><small>Total books</small><strong id="total">—</strong></div><div class="card"><small>Published books</small><strong id="published">—</strong></div><div class="card"><small>Units sold</small><strong id="units">—</strong></div></div><section class="card"><h2>Royalties by currency</h2><div id="royalties">Loading…</div></section><section class="card"><h2>My Books</h2><div id="books">Loading…</div></section><p>Data is read from your KDP Manager database. Amazon KDP is not connected; sales must be imported or entered separately.</p></main><script>
const put=(id,value)=>{document.getElementById(id).textContent=String(value)};
async function load(){try{const [a,b]=await Promise.all([fetch("/books",{cache:"no-store"}),fetch("/api/summary",{cache:"no-store"})]);if(a.status===401||b.status===401){location.assign("/login");return}if(!a.ok||!b.ok)throw Error("Data unavailable");const books=(await a.json()).books,summary=await b.json();put("total",summary.totalBooks);put("published",summary.publishedBooks);put("units",summary.unitsSold);const royalties=document.getElementById("royalties");royalties.replaceChildren();if(!summary.royaltiesByCurrency.length)royalties.textContent="No sales records yet.";for(const row of summary.royaltiesByCurrency){const p=document.createElement("p");p.textContent=row.currency+": "+row.royalties+" ("+row.units+" units)";royalties.append(p)}const list=document.getElementById("books");list.replaceChildren();if(!books.length)list.textContent="No books added yet.";for(const book of books){const item=document.createElement("div");item.className="book";const title=document.createElement("strong");title.textContent=book.title;const detail=document.createElement("small");detail.textContent=[book.author,book.category,book.status].filter(Boolean).join(" · ");item.append(title,detail);list.append(item)}}catch{put("error","Unable to load your data. Please try again later.")}}
document.getElementById("logout").addEventListener("click",async()=>{await fetch("/api/auth/logout",{method:"POST"});location.assign("/login")});load();
</script></body></html>`;

export const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (await handleAuth(req, res, path)) return;
  if (path === "/login" && req.method === "GET") {
    if (isAuthenticated(req)) { res.writeHead(302, { Location: "/", "Cache-Control": "no-store" }); res.end(); return; }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(loginPage); return;
  }
  if (path === "/" && !isAuthenticated(req)) { res.writeHead(302, { Location: "/login", "Cache-Control": "no-store" }); res.end(); return; }
  if (path === "/books" && !isAuthenticated(req)) {
    json(res, 401, { error: "Authentication required" });
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

  if (path === "/books") {
    try { json(res, 200, { books: await booksRepository.list(), demo: false }); }
    catch (error) { console.error(JSON.stringify({ event: "books_read_failed", code: error.code || "DB_ERROR" })); json(res, 503, { error: "Books temporarily unavailable" }); }
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

