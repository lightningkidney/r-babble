// Dozens of distinct villagers from: personality x bank x a name-derived offset in pitch,
// pace and melody. Deterministic, so a name always gives the same voice.

import { hashString, createRandom } from './random.js';
import { PERSONALITIES, resolveVoice } from './voice.js';

const NAMES = ['Biscuit', 'Maple', 'Pebble', 'Clover', 'Ember', 'Thistle', 'Rufus', 'Juniper', 'Moss', 'Pip', 'Hazel', 'Bramble',
  'Fennel', 'Marlow', 'Daffodil', 'Gus', 'Willow', 'Sprocket', 'Tansy', 'Otto', 'Quill', 'Beryl', 'Nimbus', 'Dot'];

/** @param {{bank?: string}} opts bank: pin a bank; otherwise the personality's own. */
export function makeVillager(name, personality, opts = {}) {
  const r = createRandom(hashString(name + ':' + personality));
  const base = resolveVoice({ personality });
  const octave = (r() - 0.5) * 0.36;              // +/- ~2 semitones around the personality's pitch
  return {
    name, personality,
    bank: opts.bank ?? base.bank,
    baseHz: Math.round(base.baseHz * 2 ** octave),
    tempo: +(0.92 + r() * 0.16).toFixed(2),
    variation: +(0.75 + r() * 0.5).toFixed(2),
    seed: hashString(name) % 100000,
  };
}

const KEYS = Object.keys(PERSONALITIES);
export const VILLAGERS = NAMES.map((n, i) => makeVillager(n, KEYS[i % KEYS.length]));
