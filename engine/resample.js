// Cubic Hermite interpolation shared by the renderer and the bank recorder.

export function hermite(s, x) {
  const i = Math.floor(x), f = x - i, n = s.length;
  const a = s[Math.max(0, i - 1)], b = s[i], c = s[Math.min(n - 1, i + 1)], d = s[Math.min(n - 1, i + 2)];
  const c1 = 0.5 * (c - a), c2 = a - 2.5 * b + 2 * c - 0.5 * d, c3 = 0.5 * (d - a) + 1.5 * (b - c);
  return ((c3 * f + c2) * f + c1) * f + b;
}

/** Resample so a unit recorded at f0 sounds at refHz (changes length by f0/refHz). */
export function flatten(unit, f0, refHz) {
  const step = refHz / f0, n = Math.floor((unit.length - 1) / step), out = new Float32Array(n);
  for (let k = 0; k < n; k++) out[k] = hermite(unit, k * step);
  return out;
}
