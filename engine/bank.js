// Voicebanks: one sprite WAV + manifest.json ("animalese-bank@1", the same layout as
// moeru-ai/animalese-js so its banks load unchanged). Units are short, loudness-equalised and
// pitch-flattened to `referenceHz`, so a unit's pitch is set by one playback rate.

import { parseWav, encodeWav } from './wav.js';

const TARGET_RMS = 0.126; // the level animalese-js bakes to; every unit is brought to it

/**
 * Trim dead air from both ends of a unit (the baker leaves up to ~160 ms of silence on a few
 * units, which would sound like a stutter) and re-equalise loudness over what remains.
 */
export function condition(unit, sr) {
  let peak = 0;
  for (const v of unit) peak = Math.max(peak, Math.abs(v));
  if (peak === 0) return unit;
  let a = 0, b = unit.length - 1;
  while (a < b && Math.abs(unit[a]) < peak * 0.08) a++;
  while (b > a && Math.abs(unit[b]) < peak * 0.03) b--;
  a = Math.max(0, a - Math.round(0.004 * sr));
  b = Math.min(unit.length - 1, b + Math.round(0.005 * sr));
  const out = unit.slice(a, b + 1);
  let e = 0;
  for (const v of out) e += v * v;
  const g = TARGET_RMS / Math.sqrt(e / out.length);
  for (let i = 0; i < out.length; i++) out[i] *= g;
  return out;
}

/** @returns {Bank} {id, label, sampleRate, referenceHz, units: Map<string, Float32Array>} */
export function loadBank(manifest, spriteBytes) {
  if (manifest.format !== 'animalese-bank@1') throw new Error(`unsupported bank format: ${manifest.format}`);
  const wav = parseWav(spriteBytes);
  if (wav.sampleRate !== manifest.sampleRate) throw new Error('sprite sample rate does not match manifest');
  const units = new Map();
  for (const [name, u] of Object.entries(manifest.units)) {
    if (u.offset + u.length > wav.samples.length) throw new Error(`unit ${name} lies outside the sprite`);
    units.set(name, condition(wav.samples.slice(u.offset, u.offset + u.length), wav.sampleRate));
  }
  return { id: manifest.id, label: manifest.label ?? manifest.id, source: manifest.source ?? '', sampleRate: wav.sampleRate, referenceHz: manifest.referenceHz, units };
}

/** Pack units (Map name -> Float32Array) into {manifest, sprite(Uint8Array WAV)} for saving. */
export function packBank({ id, label, sampleRate, referenceHz, source = 'user recording', units, gap = 480 }) {
  const parts = [], meta = {};
  let offset = 0;
  for (const [name, s] of units) {
    meta[name] = { offset, length: s.length };
    parts.push(s, new Float32Array(gap));
    offset += s.length + gap;
  }
  const all = new Float32Array(offset);
  let p = 0;
  for (const part of parts) { all.set(part, p); p += part.length; }
  return {
    manifest: { format: 'animalese-bank@1', id, label, language: 'ja', source, sampleRate, referenceHz, sprite: 'sprite.wav', createdAt: new Date().toISOString(), units: meta },
    sprite: encodeWav(all, sampleRate),
  };
}

/**
 * Find the unit to sound for `name` ("ja/ka"). Banks recorded with fewer kana still work:
 * fall back to the same vowel ("ka" -> "a"), then to any unit.
 */
export function resolveUnit(bank, name) {
  if (bank.units.has(name)) return bank.units.get(name);
  const kana = name.slice(name.indexOf('/') + 1), vowel = kana.slice(-1);
  return bank.units.get('ja/' + vowel) ?? bank.units.values().next().value;
}
