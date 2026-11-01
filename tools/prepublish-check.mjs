#!/usr/bin/env node
// Fails if the publishable file set (everything not git-ignored) contains something it should not.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ignored = readFileSync(join(root, '.gitignore'), 'utf8').split('\n').map((l) => l.trim().replace(/\/$/, '')).filter(Boolean);
const problems = [];
const files = [];
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n), rel = relative(root, p);
    if (ignored.includes(rel) || n === '.git') continue;
    statSync(p).isDirectory() ? walk(p) : files.push(rel);
  }
})(root);

for (const req of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'ASSET_LICENSES.md', 'README.md'])
  if (!existsSync(join(root, req))) problems.push(`missing ${req}`);
for (const dir of ['research', 'banks_local', 'out'])
  if (!ignored.includes(dir)) problems.push(`.gitignore must list ${dir}/`);

const assets = readFileSync(join(root, 'ASSET_LICENSES.md'), 'utf8');
const AUDIO = new Set(['.wav', '.mp3', '.aac', '.ogg', '.flac', '.m4a']);
const BINARY = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.ttf', '.otf', '.woff', '.woff2']);
for (const f of files) {
  const ext = extname(f).toLowerCase();
  if (AUDIO.has(ext)) {
    const m = f.match(/^banks\/([^/]+)\//);
    if (!m) problems.push(`audio outside banks/: ${f}`);
    else if (!assets.includes(`banks/${m[1]}/`)) problems.push(`audio not documented in ASSET_LICENSES.md: ${f}`);
    else if (!JSON.parse(readFileSync(join(root, 'banks', m[1], 'manifest.json'), 'utf8')).source) problems.push(`bank ${m[1]} has no "source" in manifest`);
  } else if (BINARY.has(ext)) problems.push(`image/font needs a licence check: ${f}`);
  else if (statSync(join(root, f)).size < 2e6) {
    const t = readFileSync(join(root, f), 'utf8');
    if (/sk-[A-Za-z0-9]{20,}|api[_-]?key\s*[:=]\s*['"][^'"]{12,}/i.test(t)) problems.push(`possible credential in ${f}`);
  }
}
console.log(`${files.length} files would be published`);
if (problems.length) { console.log('PROBLEMS:\n - ' + problems.join('\n - ')); process.exit(1); }
console.log('prepublish check OK');
