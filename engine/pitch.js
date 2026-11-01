// Pitch estimation (normalised autocorrelation). Used by the bank recorder and tests.

/** Median f0 (Hz) over voiced frames by normalised autocorrelation. */
export function medianF0(x, sr, lo = 70, hi = 900) {
  const win = Math.floor(0.04 * sr), f0s = [];
  for (let i = 0; i + 2 * win < x.length; i += Math.floor(0.02 * sr)) {
    let e = 0; for (let j = 0; j < win; j++) e += x[i + j] ** 2;
    if (Math.sqrt(e / win) < 0.03) continue;
    let best = 0, bl = 0;
    for (let l = Math.floor(sr / hi); l <= Math.floor(sr / lo); l++) {
      let c = 0, e2 = 0; for (let j = 0; j < win; j++) { c += x[i + j] * x[i + j + l]; e2 += x[i + j + l] ** 2; }
      const r = c / Math.sqrt(e * e2 + 1e-12);
      if (r > best) { best = r; bl = l; }
    }
    if (best > 0.6) f0s.push(sr / bl);
  }
  f0s.sort((a, b) => a - b);
  return f0s.length ? f0s[Math.floor(f0s.length / 2)] : NaN;
}

