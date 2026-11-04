import http from "node:http";

const PORT = Number(process.env.PORT || 3000);

const books = [
  {
    id: 1,
    title: "Sample KDP Book",
    status: "Demo",
    sales: 12
  }
];

export const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    res.writeHead(405);
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: "ok",
      application: "KDP Manager",
      version: "0.2.0"
    }));
    return;
  }

  if (req.url === "/books") {
    res.writeHead(200);
    res.end(JSON.stringify({ books, demo: true }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`KDP Manager running on port ${PORT}`);
  });
}
