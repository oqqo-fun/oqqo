// Tiny static server for local checks. Serves dist/ with the same CSP header the host would send.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };

const headersFile = await readFile(join(root, '_headers'), 'utf8').catch(() => '');
const csp = (headersFile.match(/Content-Security-Policy:\s*(.+)/) || [])[1];

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    const h = { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' };
    if (csp) h['content-security-policy'] = csp;
    res.writeHead(200, h).end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
}).listen(port, () => console.log('http://localhost:' + port));
