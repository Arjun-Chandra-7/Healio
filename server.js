/* Local static server and private care APIs. No runtime dependencies. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createHandler } = require('./lib/ai.js');
const root = __dirname;
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.woff':'font/woff', '.woff2':'font/woff2' };
function createServer(options = {}) {
  const api = createHandler(options);
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) { await api(req, res); return; }
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end('Method not allowed'); return; }
    let name;
    try { name = decodeURIComponent(url.pathname); }
    catch { res.writeHead(400); res.end('Invalid path'); return; }
    if (name === '/') name = '/index.html';
    if (name.split('/').some(part => part.startsWith('.')) || !(name === '/index.html' || /^\/(css|js|assets)\//.test(name)) || !mime[path.extname(name).toLowerCase()]) { res.writeHead(404); res.end('Not found'); return; }
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    try {
      const real = await fs.promises.realpath(file);
      if (!real.startsWith(root + path.sep) || !(await fs.promises.stat(real)).isFile()) throw new Error('Not a public file');
      res.writeHead(200, { 'Content-Type':mime[path.extname(real).toLowerCase()], 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache' });
      if (req.method === 'HEAD') res.end(); else fs.createReadStream(real).pipe(res);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
}
if (require.main === module) {
  const port = Number(process.env.PORT || process.env.HEALIO_PORT) || 8081;
  const server = createServer();
  server.on('error', error => { console.error(`Could not start Healio (${error.code}). Port ${port} may already be in use.`); process.exitCode=1; });
  server.listen(port, '127.0.0.1', () => console.log(`Healio: http://localhost:${port}`));
}
module.exports = { createServer };
