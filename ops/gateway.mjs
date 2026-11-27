// Stable production listener. Caddy continues using 172.18.0.1:5173.
import http from 'node:http';
import { readFile, realpath, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const state = process.env.BIZBUDDY_STATE || '/var/lib/bizbuddy';
const host = process.env.BIZBUDDY_HOST || '172.18.0.1';
const port = Number(process.env.BIZBUDDY_PORT || 5173);
const apiPort = Number(process.env.BIZBUDDY_API_PORT || 8000);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); }
  catch { res.writeHead(400); res.end(); return; }
  if (url.pathname.startsWith('/api/') || url.pathname === '/chatbot-widget.js') {
    const upstream = http.request({ hostname: '127.0.0.1', port: apiPort, path: req.url, method: req.method, headers: req.headers, timeout: 45000 }, reply => {
      res.writeHead(reply.statusCode, reply.headers);
      reply.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '3' });
      res.end(JSON.stringify({ detail: 'The service is updating. Please retry shortly.' }));
    });
    req.on('aborted', () => upstream.destroy());
    req.pipe(upstream);
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const release = await realpath(path.join(state, 'current'));
    if (url.pathname === '/__deployment') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ commit: path.basename(release) }));
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) { res.writeHead(404); res.end(); return; }
    const root = path.join(release, 'dist');
    let file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(404); res.end(); return; }
    let body;
    try { body = await readFile(file); }
    catch {
      if (pathname.startsWith('/assets/')) {
        // Keep old hashed assets available to already-open browser tabs.
        const releases = await readdir(path.join(state, 'releases'));
        const previous = await Promise.all(releases.filter(name => /^[a-f0-9]{40}$/.test(name)).map(async name => ({ name, time: (await stat(path.join(state, 'releases', name))).mtimeMs })));
        for (const old of previous.sort((a, b) => b.time - a.time)) {
          try { body = await readFile(path.join(state, 'releases', old.name, 'dist', pathname.slice(1))); break; } catch { /* next retained release */ }
        }
        if (!body) { res.writeHead(404); res.end(); return; }
      } else if (pathname === '/' || /^\/(signin|register|demo)\/?$/.test(pathname) || /^\/dashboard(?:\/[a-z-]+)?\/?$/.test(pathname) || /^\/chat\/[^/]+\/?$/.test(pathname)) {
        file = path.join(root, 'index.html'); body = await readFile(file);
      } else { res.writeHead(404); res.end(); return; }
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(503, { 'Retry-After': '3' }); res.end('Deployment is not ready.'); }
});
server.requestTimeout = 60000;
let attempts = 0;
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && attempts++ < 100) { setTimeout(() => server.listen(port, host), 100); }
  else { console.error(error.message); process.exit(1); }
});
server.listen(port, host, () => console.log(`BizBuddy production gateway listening on ${host}:${port}`));
process.on('SIGTERM', () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); });
