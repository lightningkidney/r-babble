// Node helper: load a bank directory (manifest.json + sprite.wav).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBank } from '../engine/index.js';
export function loadBankDir(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  return loadBank(manifest, readFileSync(join(dir, manifest.sprite)));
}
