// Tiny local static server. Serves the project, plus GET /api/banks listing banks/ and banks_local/.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = +(process.env.PORT || 8765);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wav': 'audio/wav' };
const open = ['app', 'engine', 'banks', 'banks_local'];

async function listBanks() {
  const out = [];
  for (const dir of ['banks', 'banks_local']) {
    for (const d of await readdir(join(root, dir)).catch(() => [])) {
      try {
        const m = JSON.parse(await readFile(join(root, dir, d, 'manifest.json'), 'utf8'));
        out.push({ id: m.id ?? d, label: m.label ?? m.id ?? d, path: `/${dir}/${d}/`, local: dir === 'banks_local', source: m.source ?? '' });
      } catch { /* not a bank */ }
    }
  }
  return out;
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/banks') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(await listBanks())); }
    let rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
    if (rel === '') { res.statusCode = 302; res.setHeader('location', '/app/index.html'); return res.end(); }
    if (!open.includes(rel.split(sep)[0]) || rel.includes('..')) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('content-type', types[extname(rel)] ?? 'application/octet-stream');
    res.end(await readFile(join(root, rel)));
  } catch { res.statusCode = 404; res.end('not found'); }
}).listen(port, '127.0.0.1', () => console.log(`R-Babble: http://127.0.0.1:${port}/`));
