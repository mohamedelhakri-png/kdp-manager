
import http from "node:http";
import { createAuthHandler, isAuthenticated } from "./auth/auth.js";
const handleAuth = createAuthHandler();
import { createDatabasePool } from "./database/connection.js";
import { createBooksRepository } from "./database/books-repository.js";
import { validateBook, validBookId } from "./database/book-validation.js";
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
*{box-sizing:border-box}body{margin:0;background:#f4f6fa;color:#17233d;font:16px Arial,sans-serif}header{background:#17233d;color:white;padding:20px}header h1{margin:0 0 8px}header p{margin:0;color:#b9c6db}button{cursor:pointer;border:0;border-radius:9px;padding:10px 16px}#logout{float:right;background:#fff;color:#17233d}main{max-width:1000px;margin:auto;padding:20px}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.card{background:white;padding:20px;border-radius:12px;margin-bottom:14px;box-shadow:0 3px 14px #15213d0a}.card small{display:block;color:#64748b}.card strong{display:block;font-size:25px;margin-top:10px}.book{padding:14px 0;border-bottom:1px solid #e2e8f0}.book:last-child{border:0}.book small{margin-top:6px}#error{color:#b91c1c}.fields{display:grid;grid-template-columns:1fr;gap:12px}label{display:block;margin:10px 0;font-weight:600}input,select,textarea{display:block;width:100%;padding:11px;margin-top:6px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}.actions{display:flex;gap:10px;flex-wrap:wrap}.actions button{background:#2563eb;color:white}.actions button:disabled{opacity:.6}#form-message{min-height:20px;color:#334155}.edit-book{margin-top:8px;background:#e2e8f0}@media(min-width:700px){.fields{grid-template-columns:repeat(2,1fr)}}@media(min-width:700px){.stats{grid-template-columns:repeat(3,1fr)}}
</style></head><body><header><button id="logout" type="button">Sign out</button><h1>KDP Manager</h1><p>Private publishing dashboard</p></header><main><p id="error" role="alert"></p><div class="stats"><div class="card"><small>Total books</small><strong id="total">—</strong></div><div class="card"><small>Published books</small><strong id="published">—</strong></div><div class="card"><small>Units sold</small><strong id="units">—</strong></div></div><section class="card"><h2>Royalties by currency</h2><div id="royalties">Loading…</div></section><section class="card"><h2 id="form-heading">Add a book</h2><form id="book-form">
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
</form></section><section class="card"><h2>My Books</h2><div id="books">Loading…</div></section><p>Data is read from your KDP Manager database. Amazon KDP is not connected; sales must be imported or entered separately.</p></main><script>
let loadedBooks=[];
const put=(id,value)=>{document.getElementById(id).textContent=String(value)};
async function load(){try{const [a,b]=await Promise.all([fetch("/books",{cache:"no-store"}),fetch("/api/summary",{cache:"no-store"})]);if(a.status===401||b.status===401){location.assign("/login");return}if(!a.ok||!b.ok)throw Error("Data unavailable");const books=(await a.json()).books,summary=await b.json();loadedBooks=books;put("total",summary.totalBooks);put("published",summary.publishedBooks);put("units",summary.unitsSold);const royalties=document.getElementById("royalties");royalties.replaceChildren();if(!summary.royaltiesByCurrency.length)royalties.textContent="No sales records yet.";for(const row of summary.royaltiesByCurrency){const p=document.createElement("p");p.textContent=row.currency+": "+row.royalties+" ("+row.units+" units)";royalties.append(p)}const list=document.getElementById("books");list.replaceChildren();if(!books.length)list.textContent="No books added yet.";for(const book of books){const item=document.createElement("div");item.className="book";const title=document.createElement("strong");title.textContent=book.title;const detail=document.createElement("small");detail.textContent=[book.author,book.category,book.status].filter(Boolean).join(" · ");const edit=document.createElement("button");edit.type="button";edit.className="edit-book";edit.textContent="Edit";edit.addEventListener("click",()=>editBook(book));item.append(title,detail,edit);list.append(item)}}catch{put("error","Unable to load your data. Please try again later.")}}
const bookFields=["title","subtitle","author","asin","isbn","category","format","status","publication_date","notes"];
function resetForm(){document.getElementById("book-form").reset();put("book-id","");document.getElementById("book-id").value="";put("form-heading","Add a book");document.getElementById("cancel-edit").hidden=true;put("form-message","")}
function editBook(book){document.getElementById("book-id").value=book.id;for(const key of bookFields){let value=book[key]??"";if(key==="publication_date"&&value)value=String(value).slice(0,10);document.getElementById("book-"+key).value=value}put("form-heading","Edit book");document.getElementById("cancel-edit").hidden=false;put("form-message","");document.getElementById("book-form").scrollIntoView({behavior:"smooth"})}
document.getElementById("cancel-edit").addEventListener("click",resetForm);
document.getElementById("book-form").addEventListener("submit",async e=>{e.preventDefault();const id=document.getElementById("book-id").value;const payload={};for(const key of bookFields)payload[key]=document.getElementById("book-"+key).value;const save=document.getElementById("save-book");save.disabled=true;put("form-message","Saving…");try{const response=await fetch(id?"/api/books/"+encodeURIComponent(id):"/api/books",{method:id?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});if(response.status===401){location.assign("/login");return}const data=await response.json();if(!response.ok){put("form-message",data.error||"Unable to save book");return}resetForm();put("form-message",id?"Book updated successfully.":"Book added successfully.");await load()}catch{put("form-message","Connection error. Please retry.")}finally{save.disabled=false}});
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

