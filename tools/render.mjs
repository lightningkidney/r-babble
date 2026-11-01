#!/usr/bin/env node
// node tools/render.mjs "Hello there!" --voice peppy --bank ja-nova --hz 500 --tempo 1 --seed 3 --out out/x.wav
import { writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { synthesize, encodeWav, resolveVoice } from '../engine/index.js';
import { loadBankDir } from './nodebank.mjs';

const args = process.argv.slice(2), text = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i > 0 ? args[i + 1] : d; };
if (!text) { console.error('usage: render.mjs "text" [--voice personality] [--bank id] [--hz N] [--tempo N] [--variation N] [--seed N] [--out file.wav]'); process.exit(1); }
const voice = { personality: opt('voice', 'normal') };
for (const k of ['hz', 'tempo', 'variation', 'seed']) if (opt(k)) voice[k === 'hz' ? 'baseHz' : k] = +opt(k);
const bankId = opt('bank', resolveVoice(voice).bank);
const dir = ['banks', 'banks_local'].map((d) => `${d}/${bankId}`).find(existsSync);
if (!dir) { console.error('no such bank: ' + bankId); process.exit(1); }
const r = synthesize(text, voice, loadBankDir(dir));
const out = opt('out', 'out/render.wav');
writeFileSync(out, encodeWav(r.samples, r.sampleRate));
console.log(`${out}: ${r.plan.events.length} units, ${(r.samples.length / r.sampleRate).toFixed(2)} s`);
