// Minimal WAV reader/writer (PCM 8/16/24/32-bit and float32 in; 16-bit mono out).

/** @param {ArrayBuffer|Uint8Array} data -> {sampleRate, samples: Float32Array} (mono mixdown) */
export function parseWav(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o) => String.fromCharCode(...bytes.subarray(o, o + 4));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
  let fmt = null, pcm = null;
  for (let o = 12; o + 8 <= bytes.length;) {
    const id = tag(o), size = v.getUint32(o + 4, true);
    if (id === 'fmt ') fmt = { format: v.getUint16(o + 8, true), ch: v.getUint16(o + 10, true), rate: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
    else if (id === 'data') pcm = { off: o + 8, len: Math.min(size, bytes.length - o - 8) };
    o += 8 + size + (size & 1);
  }
  if (!fmt || !pcm) throw new Error('WAV missing fmt/data chunk');
  const bps = fmt.bits / 8, frames = Math.floor(pcm.len / (bps * fmt.ch));
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < fmt.ch; c++) {
      const p = pcm.off + (i * fmt.ch + c) * bps;
      sum += fmt.format === 3 ? v.getFloat32(p, true)
        : fmt.bits === 8 ? (bytes[p] - 128) / 128
        : fmt.bits === 16 ? v.getInt16(p, true) / 32768
        : fmt.bits === 24 ? ((bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16)) << 8 >> 8) / 8388608
        : v.getInt32(p, true) / 2147483648;
    }
    out[i] = sum / fmt.ch;
  }
  return { sampleRate: fmt.rate, samples: out };
}

/** Float32 mono -> 16-bit PCM WAV bytes (clipped, not dithered). */
export function encodeWav(samples, sampleRate) {
  const buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
  return new Uint8Array(buf);
}
