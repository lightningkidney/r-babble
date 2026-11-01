// Voice options and the eight personality presets.
//
// Pitch figures: measured on ACNH recordings by animalese-js (cranky ~115 Hz, smug ~330 Hz,
// lazy ~445 Hz). The rest are estimates from how the personalities sound in game; tune them
// against your own reference clips with tools/measure.mjs. Pitch is absolute (Hz) because
// villagers differ by individual as well as by personality.

export const SCALES = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  'major-pentatonic': [0, 2, 4, 7, 9],
  'minor-pentatonic': [0, 3, 5, 7, 10],
  'whole-tone': [0, 2, 4, 6, 8, 10],
};

export const DEFAULT_VOICE = {
  bank: 'ja-nova',
  baseHz: 400,
  tempo: 1,          // overall speaking-speed multiplier: scales textRate and speed, divides pauses
  textRate: 15,      // dialogue-box beats/s (one beat = 3.7 letters: 15 -> 55 letters/s, mid of the measured 45-70)
  speed: 8.5,        // voice speed; x1.6 English multiplier = ~13.6 units/s
  variation: 1,      // scales melody range and per-unit jitter; 0 = monotone
  scale: 'major-pentatonic',
  range: 2,          // melody wander, scale degrees each way
  liveliness: 0.45,  // chance per unit that the melody moves
  jitter: 0.25,      // random per-unit detune, semitones (+/-)
  declination: 2,    // pitch fall across a sentence, semitones
  questionRise: 4,
  exclaimLift: 2,
  glide: -1.2,       // pitch bend inside each unit, semitones (the game's units fall slightly)
  timingJitter: 0.1,
  sustain: -0.1,
  volume: 0.9,
  pauses: { space: 0.015, comma: 0.22, period: 0.4, question: 0.4, exclaim: 0.34, ellipsis: 0.55, newline: 0.45 },
  seed: null,        // null = derived from the text
};

export const ENGLISH_VOICE_RATE = 1.6; // voice slots per `speed`, calibrated to 13-14 units/s
export const CHARS_PER_BEAT = 3.7;

export const PERSONALITIES = {
  normal:    { label: 'Normal' },
  peppy:     { label: 'Peppy',      baseHz: 520, textRate: 17, speed: 9.5, range: 3, liveliness: 0.7, scale: 'major', exclaimLift: 3, jitter: 0.35 },
  snooty:    { label: 'Snooty',     baseHz: 470, textRate: 14, speed: 8.5, range: 2, liveliness: 0.4, scale: 'minor', glide: -1.6, jitter: 0.15 },
  bigSister: { label: 'Big Sister', baseHz: 300, textRate: 14.5, speed: 8.5, range: 2, liveliness: 0.45, scale: 'minor-pentatonic', declination: 2.5 },
  lazy:      { label: 'Lazy',       baseHz: 440, textRate: 12, speed: 7.5, range: 1, liveliness: 0.25, timingJitter: 0.2, declination: 3, glide: -1.8 },
  jock:      { label: 'Jock',       bank: 'ja-onyx', baseHz: 220, textRate: 15.5, speed: 9, range: 2, liveliness: 0.55, exclaimLift: 4, jitter: 0.3 },
  cranky:    { label: 'Cranky',     bank: 'ja-onyx', baseHz: 115, textRate: 12, speed: 7, range: 2, liveliness: 0.35, scale: 'minor-pentatonic', declination: 3, glide: -0.6, jitter: 0.2 },
  smug:      { label: 'Smug',       baseHz: 330, textRate: 13.5, speed: 8, range: 3, liveliness: 0.45, scale: 'whole-tone', glide: -1.4 },
};

/** Full options: defaults <- personality preset <- overrides. */
export function resolveVoice(input = {}) {
  const { personality = 'normal', pauses, label, ...overrides } = input;
  const preset = PERSONALITIES[personality] ?? {};
  const { label: _l, ...presetOpts } = preset;
  return { ...DEFAULT_VOICE, ...presetOpts, ...overrides, pauses: { ...DEFAULT_VOICE.pauses, ...(presetOpts.pauses ?? {}), ...(pauses ?? {}) } };
}
