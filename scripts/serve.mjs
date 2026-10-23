// QA 脚本用的零依赖静态服务：把仓库根目录挂到 127.0.0.1 的空闲端口
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain' };
const ROOT = fileURLToPath(new URL('..', import.meta.url));

export async function serve() {
  const srv = http.createServer((q, r) => {
    const p = decodeURIComponent(new URL(q.url, 'http://x').pathname); const f = path.join(ROOT, p.endsWith('/') ? p + 'index.html' : p);
    if (!f.startsWith(ROOT)) return r.writeHead(403).end();
    fs.readFile(f, (e, d) => e ? r.writeHead(404).end() : r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }).end(d));
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() };
}
