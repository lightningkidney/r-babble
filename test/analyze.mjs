// Audio measurements shared by the test run and tools/measure.mjs.

/** RMS envelope in `hop`-second frames. */
export function envelope(x, sr, hop = 0.005) {
  const n = Math.floor(hop * sr), out = [];
  for (let i = 0; i + n <= x.length; i += n) { let s = 0; for (let j = 0; j < n; j++) s += x[i + j] ** 2; out.push(Math.sqrt(s / n)); }
  return { env: out, hop };
}

/** Voiced runs separated by >= minGap seconds of quiet. Returns [{start,end}] seconds. */
export function segments(x, sr, { thresh = 0.02, minGap = 0.02 } = {}) {
  const { env, hop } = envelope(x, sr);
  const runs = []; let cur = null, quiet = 0;
  env.forEach((v, i) => {
    if (v > thresh) { if (!cur) cur = { start: i * hop, end: 0 }; cur.end = (i + 1) * hop; quiet = 0; }
    else if (cur && (quiet += hop) >= minGap) { runs.push(cur); cur = null; }
  });
  if (cur) runs.push(cur);
  return runs;
}

/** Click detector: largest |second difference| relative to the local (20 ms) RMS. */
export function clickScore(x, sr) {
  const w = Math.floor(0.02 * sr); let worst = 0, at = 0;
  for (let i = 2; i < x.length; i++) {
    const d2 = Math.abs(x[i] - 2 * x[i - 1] + x[i - 2]);
    if (d2 < 0.05) continue;
    let s = 0, c = 0; for (let j = Math.max(0, i - w); j < Math.min(x.length, i + w); j += 4) { s += x[j] ** 2; c++; }
    const rms = Math.sqrt(s / c) + 1e-4, score = d2 / rms;
    if (score > worst) { worst = score; at = i / sr; }
  }
  return { worst, at };
}

export function stats(x) {
  let peak = 0, bad = 0, sum = 0;
  for (const v of x) { if (!Number.isFinite(v)) bad++; peak = Math.max(peak, Math.abs(v)); sum += v * v; }
  return { peak, bad, rms: Math.sqrt(sum / x.length) };
}

export { medianF0 } from '../engine/pitch.js';
