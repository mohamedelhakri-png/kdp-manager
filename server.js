
import http from "node:http";

const PORT = Number(process.env.PORT || 3000);

const books = [
  {
    id: 1,
    title: "The Quiet Garden",
    category: "Coloring Book",
    status: "Published",
    sales: 42,
    revenue: 126.00
  },
  {
    id: 2,
    title: "Mindful Daily Planner",
    category: "Planner",
    status: "Published",
    sales: 28,
    revenue: 112.00
  },
  {
    id: 3,
    title: "Little Explorers Activity Book",
    category: "Activity Book",
    status: "Draft",
    sales: 0,
    revenue: 0
  }
];

const json = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(data));
};

const dashboard = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KDP Manager</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f4f6fa;color:#17233d;font-family:Arial,sans-serif}
header{background:#17233d;color:white;padding:20px}
header h1{margin:0;font-size:24px}
header p{color:#b9c6db;margin:8px 0 0}
nav{display:flex;gap:10px;overflow-x:auto;padding:15px;background:white}
nav button{border:0;border-radius:9px;padding:12px 16px;background:#eef1f7;color:#17233d;font-weight:bold;cursor:pointer;white-space:nowrap}
nav button.active{background:#2563eb;color:white}
main{max-width:1100px;margin:auto;padding:20px}
.notice{background:#fff5d9;padding:14px;border-radius:10px;margin-bottom:20px;color:#7a5600}
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.card{background:white;padding:20px;border-radius:14px;box-shadow:0 3px 14px #15213d0a}
.card small{color:#718096}
.card strong{display:block;font-size:27px;margin-top:12px}
section{margin-top:22px}
h2{font-size:21px}
.book{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #edf0f5;padding:15px 0}
.book:last-child{border:0}
.book strong{display:block}
.book small{display:block;margin-top:7px;color:#718096}
.pill{font-size:12px;padding:6px 10px;border-radius:20px;background:#dcfce7;color:#166534;height:max-content}
.pill.draft{background:#fef3c7;color:#92400e}
.bar{height:12px;background:#e9eef8;border-radius:10px;overflow:hidden;margin:10px 0 18px}
.bar span{display:block;height:100%;background:#2563eb;border-radius:10px}
.hidden{display:none}
footer{text-align:center;color:#8892a4;padding:30px;font-size:12px}
@media(min-width:800px){.stats{grid-template-columns:repeat(4,1fr)}header{padding:30px 8%}}
</style>
</head>
<body>
<header>
<h1>KDP Manager</h1>
<p>Publishing dashboard · Version 0.3</p>
</header>
<nav>
<button class="active" onclick="show('overview',this)">Overview</button>
<button onclick="show('books',this)">My Books</button>
<button onclick="show('analytics',this)">Analytics</button>
<button onclick="show('reports',this)">Reports</button>
</nav>
<main>
<div class="notice">DEMO MODE — All book titles, sales and earnings are fictional. No Amazon KDP account is connected.</div>
<div id="overview">
<h2>Dashboard Overview</h2>
<div class="stats">
<div class="card"><small>Total Books</small><strong>3</strong></div>
<div class="card"><small>Published</small><strong>2</strong></div>
<div class="card"><small>Units Sold</small><strong>70</strong></div>
<div class="card"><small>Demo Revenue</small><strong>$238</strong></div>
</div>
<section class="card">
<h2>Welcome to KDP Manager</h2>
<p>Your publishing workspace is online and ready for the next development stage.</p>
<p>Explore the demonstration data using the navigation tabs.</p>
</section>
</div>
<div id="books" class="hidden">
<h2>My Books</h2>
<div class="card">
${books.map(b => `<div class="book"><div><strong>${b.title}</strong><small>${b.category} · ${b.sales} sales · $${b.revenue.toFixed(2)}</small></div><span class="pill ${b.status === "Draft" ? "draft" : ""}">${b.status}</span></div>`).join("")}
</div>
</div>
<div id="analytics" class="hidden">
<h2>Sales Analytics</h2>
<div class="card">
<p>The Quiet Garden — 42 sales</p>
<div class="bar"><span style="width:100%"></span></div>
<p>Mindful Daily Planner — 28 sales</p>
<div class="bar"><span style="width:67%"></span></div>
<p>Little Explorers Activity Book — 0 sales</p>
<div class="bar"><span style="width:0%"></span></div>
</div>
</div>
<div id="reports" class="hidden">
<h2>Publishing Reports</h2>
<div class="card">
<p><strong>Demo total sales:</strong> 70</p>
<p><strong>Demo total revenue:</strong> $238.00</p>
<p><strong>Published books:</strong> 2</p>
<p><strong>Draft books:</strong> 1</p>
<p>CSV exports and real KDP report imports are planned for a later version.</p>
</div>
</div>
</main>
<footer>KDP Manager 0.3 · Demo Dashboard</footer>
<script>
function show(id,button){
document.querySelectorAll("main > div[id]").forEach(el=>el.classList.add("hidden"));
document.getElementById(id).classList.remove("hidden");
document.querySelectorAll("nav button").forEach(el=>el.classList.remove("active"));
button.classList.add("active");
}
</script>
</body>
</html>`;

export const server = http.createServer((req, res) => {
  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const path = new URL(req.url, "http://localhost").pathname;

  if (path === "/health") {
    json(res, 200, {
      status: "ok",
      application: "KDP Manager",
      version: "0.3.0"
    });
    return;
  }

  if (path === "/books") {
    json(res, 200, { books, demo: true });
    return;
  }

  if (path === "/") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });
    res.end(dashboard);
    return;
  }

  json(res, 404, { error: "Not found" });
});

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, "0.0.0.0", () => {
    console.log("KDP Manager running on port " + PORT);
  });
}

