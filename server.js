const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const port = Number(process.env.PORT || 5000);
const dataDir = process.env.DATA_DIR || (process.env.AMVERA ? "/data" : path.join(__dirname, "data"));
const dataFile = path.join(dataDir, "items.json");
const publicDir = path.join(__dirname, "public");

async function readItems() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    return JSON.parse(await fs.readFile(dataFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await fs.writeFile(dataFile, "[]");
    return [];
  }
}

async function writeItems(items) {
  await fs.writeFile(dataFile, JSON.stringify(items, null, 2));
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function body(request) {
  let value = "";
  for await (const chunk of request) value += chunk;
  return JSON.parse(value || "{}");
}

async function serveStatic(response, pathname) {
  const files = { "/": "index.html", "/app.js": "app.js", "/styles.css": "styles.css" };
  const name = files[pathname];
  if (!name) return false;
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
  response.writeHead(200, { "Content-Type": types[path.extname(name)] });
  response.end(await fs.readFile(path.join(publicDir, name)));
  return true;
}

const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (request.method === "GET" && pathname === "/api/health") return json(response, 200, { ok: true, framework: "Node.js", storage: dataFile });
    if (request.method === "GET" && pathname === "/api/items") {
      const items = await readItems();
      return json(response, 200, { items: items.toReversed(), count: items.length });
    }
    if (request.method === "POST" && pathname === "/api/items") {
      const data = await body(request);
      const name = String(data.name || "").trim();
      if (!name || name.length > 120) return json(response, 400, { error: "Name must contain from 1 to 120 characters" });
      const items = await readItems();
      const item = { id: items.reduce((max, value) => Math.max(max, value.id), 0) + 1, name };
      items.push(item);
      await writeItems(items);
      return json(response, 201, { item });
    }
    const match = pathname.match(/^\/api\/items\/(\d+)$/);
    if (request.method === "DELETE" && match) {
      const items = await readItems();
      const next = items.filter(item => item.id !== Number(match[1]));
      if (next.length === items.length) return json(response, 404, { error: "Item not found" });
      await writeItems(next);
      return json(response, 200, { deleted: true, id: Number(match[1]) });
    }
    if (request.method === "GET" && await serveStatic(response, pathname)) return;
    json(response, 404, { error: "Not found" });
  } catch (error) {
    json(response, 500, { error: "Internal server error" });
  }
});

server.listen(port, "0.0.0.0");
