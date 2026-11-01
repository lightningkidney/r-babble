// Events -> audio. Each unit is the bank sample resampled at rate = hz / referenceHz (with a small
// pitch glide), faded in/out so nothing clicks, and mixed at its onset. Output is a plain
// Float32Array so playback, WAV export and tests all hear exactly the same audio.

import { plan } from './plan.js';
import { resolveUnit } from './bank.js';
import { hermite } from './resample.js';

const ATTACK = 0.004, RELEASE = 0.012; // seconds

const TARGET_RMS = 0.126; // matches bank conditioning

/**
 * Render one unit into `out` at sample offset `start`. The unit is resampled into a scratch
 * buffer first so its loudness can be matched over the part that is actually heard (slots cut
 * units to ~70 ms, so whole-unit loudness is not enough).
 */
function mixUnit(out, outRate, start, src, srcRate, rate0, glideSt, gain, maxSec) {
  const maxN = Math.floor(maxSec * outRate);
  const relN = Math.max(1, Math.floor(RELEASE * outRate)), attN = Math.max(1, Math.floor(ATTACK * outRate));
  const step0 = (rate0 * srcRate) / outRate; // source samples per output sample
  const natural = Math.floor(src.length / step0);
  const n = Math.min(maxN, natural);
  const tmp = new Float32Array(n);
  let pos = 0, len = 0;
  for (let k = 0; k < n; k++) {
    // glide ramps linearly in semitones over the unit
    const rate = step0 * 2 ** ((glideSt * k) / Math.max(1, natural) / 12);
    if (pos >= src.length - 1) break;
    tmp[k] = hermite(src, pos);
    pos += rate;
    len = k + 1;
  }
  let e = 0;
  for (let k = 0; k < len; k++) e += tmp[k] * tmp[k];
  const fit = len ? Math.min(2.8, TARGET_RMS / Math.sqrt(e / len + 1e-12)) : 0; // cap boost at ~9 dB
  for (let k = 0; k < len && start + k < out.length; k++) {
    let g = gain * fit;
    if (k < attN) g *= k / attN;
    if (len - k < relN) g *= (len - k) / relN;
    out[start + k] += tmp[k] * g;
  }
  return len;
}

/**
 * @param {string} text
 * @param {object} voice voice options (see voice.js); `bank` is ignored here
 * @param {Bank} bank
 * @param {{sampleRate?:number, tail?:number}} opts
 * @returns {{samples: Float32Array, sampleRate: number, plan: object}}
 */
export function synthesize(text, voice, bank, { sampleRate = 48000, tail = 0.15 } = {}) {
  const p = plan(text, voice);
  const out = new Float32Array(Math.ceil((p.duration + tail) * sampleRate) + 1);
  for (const e of p.events) {
    const src = resolveUnit(bank, e.unit);
    if (!src) continue;
    mixUnit(out, sampleRate, Math.round(e.time * sampleRate), src, bank.sampleRate, e.hz / bank.referenceHz, e.glide, e.gain, e.maxDuration);
  }
  // Safety limiter: only acts if overlaps pushed the mix over full scale.
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.98) for (let i = 0; i < out.length; i++) out[i] *= 0.98 / peak;
  return { samples: out, sampleRate, plan: p };
}
