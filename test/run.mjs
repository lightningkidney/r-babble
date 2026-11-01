// Renders the five test sentences with every personality, checks the audio, writes WAVs to out/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { synthesize, encodeWav, PERSONALITIES, resolveVoice } from '../engine/index.js';
import { loadBankDir } from '../tools/nodebank.mjs';
import { segments, clickScore, medianF0, stats, envelope } from './analyze.mjs';

const SENTENCES = [
  'Hello! Welcome to my island!',
  'What are you doing here?',
  'Oh no! I can\'t believe it!',
  'Would you like to buy something?',
  'I think we\'re going to be great friends!',
];
const banks = { 'ja-nova': loadBankDir('banks/ja-nova'), 'ja-onyx': loadBankDir('banks/ja-onyx') };
let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL', m); };

console.log('voice       | n  | dur  | peak | units/s burst | click | f0 med | level spread dB');
const f0ByVoice = {};
for (const [pid, preset] of Object.entries(PERSONALITIES)) {
  mkdirSync(`out/${pid}`, { recursive: true });
  const f0s = [];
  SENTENCES.forEach((text, n) => {
    const voice = { personality: pid };
    const r = synthesize(text, voice, banks[resolveVoice(voice).bank]);
    writeFileSync(`out/${pid}/${n + 1}.wav`, encodeWav(r.samples, r.sampleRate));
    const st = stats(r.samples), cl = clickScore(r.samples, r.sampleRate);
    const ev = r.plan.events;
    // Per-unit RMS over its own window, to check level consistency.
    const levels = ev.map((e) => {
      const a = Math.floor(e.time * r.sampleRate), b = a + Math.floor(Math.min(e.maxDuration, 0.06) * r.sampleRate);
      let s = 0; for (let i = a; i < b; i++) s += r.samples[i] ** 2; return 20 * Math.log10(Math.sqrt(s / (b - a)) + 1e-9);
    });
    const spread = Math.max(...levels) - Math.min(...levels);
    // Burst rate = units per second across consecutive onsets < 0.2 s apart (i.e. inside a phrase).
    const gaps = ev.slice(1).map((e, i) => e.time - ev[i].time).filter((g) => g < 0.2);
    const burst = gaps.length / gaps.reduce((p, q) => p + q, 0);
    const f0 = medianF0(r.samples, r.sampleRate); f0s.push(f0);
    const segs = segments(r.samples, r.sampleRate);
    console.log(`${pid.padEnd(11)} | ${n + 1}  | ${(r.samples.length / r.sampleRate).toFixed(2)} | ${st.peak.toFixed(2)} | ${burst.toFixed(1).padStart(5)}         | ${cl.worst.toFixed(1).padStart(5)} | ${f0.toFixed(0).padStart(5)}  | ${spread.toFixed(1)}`);
    if (st.bad) fail(`${pid}/${n + 1}: NaN/Inf samples`);
    if (st.peak > 0.99) fail(`${pid}/${n + 1}: clipping`);
    if (st.peak < 0.2) fail(`${pid}/${n + 1}: too quiet`);
    if (cl.worst > 40) fail(`${pid}/${n + 1}: click at ${cl.at.toFixed(3)}s score ${cl.worst.toFixed(1)}`);
    if (spread > 8) fail(`${pid}/${n + 1}: unit level spread ${spread.toFixed(1)} dB`);
    if (segs.length < 2) fail(`${pid}/${n + 1}: only ${segs.length} audible segments`);
    if (burst < 10 || burst > 18) fail(`${pid}/${n + 1}: burst rate ${burst.toFixed(1)} units/s`);
  });
  f0ByVoice[pid] = f0s.filter(Number.isFinite).reduce((a, b) => a + b, 0) / f0s.length;
}

console.log('\nmean f0 by voice:', Object.entries(f0ByVoice).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', '));
const sorted = Object.values(f0ByVoice).sort((a, b) => a - b);
sorted.slice(1).forEach((v, i) => { if (v - sorted[i] < 8) fail(`two voices closer than 8 Hz (${sorted[i].toFixed(0)}, ${v.toFixed(0)})`); });

// Determinism, seeds.
const a = synthesize(SENTENCES[0], { personality: 'peppy', seed: 7 }, banks['ja-nova']).samples;
const b = synthesize(SENTENCES[0], { personality: 'peppy', seed: 7 }, banks['ja-nova']).samples;
const c = synthesize(SENTENCES[0], { personality: 'peppy', seed: 8 }, banks['ja-nova']).samples;
if (a.length !== b.length || a.some((v, i) => v !== b[i])) fail('same seed gave different audio');
if (a.length === c.length && a.every((v, i) => v === c[i])) fail('different seeds gave identical audio');
console.log('seed repeatability:', 'ok');

// Speed scaling: faster speed => shorter audio, roughly proportional.
const dur = (tempo) => synthesize(SENTENCES[4], { tempo, seed: 1 }, banks['ja-nova']).samples.length;
const d1 = dur(0.7), d2 = dur(1.4);
console.log(`tempo 0.7 -> ${(d1 / 48000).toFixed(2)}s, tempo 1.4 -> ${(d2 / 48000).toFixed(2)}s`);
if (!(d2 < d1 * 0.6)) fail('tempo 1.4 not clearly faster than tempo 0.7');

// Punctuation: question rises, statement falls; pause lengths.
const mean = (xs) => xs.reduce((p, q) => p + q, 0) / xs.length;
const lastHz = (t) => { const e = synthesize(t, { seed: 3, jitter: 0 }, banks['ja-nova']).plan.events; return mean(e.slice(-3).map((x) => x.hz)); };
const q = lastHz('Are you coming?'), s = lastHz('Are you coming.');
console.log(`final-3-unit pitch: "?" ${q.toFixed(0)} Hz vs "." ${s.toFixed(0)} Hz`);
if (!(q > s * 1.1)) fail('question does not rise');
const gap = (t) => { const e = synthesize(t, { seed: 3 }, banks['ja-nova']).plan.events; return Math.max(...e.slice(1).map((x, i) => x.time - e[i].time)); };
const g1 = gap('Hello there'), g2 = gap('Hello, there'), g3 = gap('Hello. There');
console.log(`longest gap: none ${g1.toFixed(2)}s, comma ${g2.toFixed(2)}s, period ${g3.toFixed(2)}s`);
if (!(g3 > g2 && g2 > g1)) fail('pause ordering wrong');

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
