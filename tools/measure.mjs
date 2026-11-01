#!/usr/bin/env node
// node tools/measure.mjs clip.wav [more.wav ...]
// Prints duration, voiced-unit rate, median pitch and level, to compare a rendered line with a
// reference recording you own (e.g. a captured New Horizons line) and tune voice.js against it.
import { readFileSync } from 'node:fs';
import { parseWav } from '../engine/index.js';
import { envelope, medianF0, stats } from '../test/analyze.mjs';

for (const f of process.argv.slice(2)) {
  const { sampleRate: sr, samples: x } = parseWav(readFileSync(f));
  const { env: raw, hop } = envelope(x, sr, 0.005);
  const env = raw.map((_, i) => { let t = 0, c = 0; for (let j = Math.max(0, i - 2); j <= Math.min(raw.length - 1, i + 2); j++) { t += raw[j]; c++; } return t / c; });
  const peak = Math.max(...env), thr = peak * 0.2;
  // One unit = one envelope peak that stands out from the valleys on both sides (units that
  // touch still dip a little). Prominence 12% of the loudest peak; peaks < 40 ms apart merge.
  const peaks = [];
  env.forEach((v, i) => {
    if (v < thr || v < (env[i - 1] ?? 0) || v <= (env[i + 1] ?? 0)) return;
    let l = v, r = v; for (let j = i; j >= 0 && env[j] <= v; j--) l = Math.min(l, env[j]);
    for (let j = i; j < env.length && env[j] <= v; j++) r = Math.min(r, env[j]);
    if (v - Math.max(l, r) >= peak * 0.12) peaks.push(i * hop);
  });
  const onsets = peaks.filter((t, i) => i === 0 || t - peaks[i - 1] >= 0.04);
  const gaps = onsets.slice(1).map((t, i) => t - onsets[i]).filter((g) => g < 0.2);
  const active = env.filter((v) => v > thr).length * hop;
  console.log(`${f}\n  duration ${(x.length / sr).toFixed(2)} s | onsets ${onsets.length} | in-phrase rate ${(gaps.length / gaps.reduce((a, b) => a + b, 0)).toFixed(1)} units/s | median f0 ${medianF0(x, sr).toFixed(0)} Hz | active ${(100 * active / (x.length / sr)).toFixed(0)}% | peak ${stats(x).peak.toFixed(2)}`);
}
