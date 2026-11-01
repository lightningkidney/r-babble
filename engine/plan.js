// Text + voice -> timed, pitched events. Adapted from the two-clock model in moeru-ai/animalese-js
// (MIT): the dialogue box reveals text at `textRate`; the voice ticks at most `speed` times per
// second, saying the latest revealed unit and skipping what it cannot keep up with.

import { tokenize } from './text.js';
import { createRandom, hashString } from './random.js';
import { resolveVoice, SCALES, ENGLISH_VOICE_RATE, CHARS_PER_BEAT } from './voice.js';

const TAIL = 3; // units at the end of a sentence bent by ? and !
const SENTENCE_END = new Set(['period', 'question', 'exclaim', 'ellipsis', 'newline']);

function degreeToSemitones(scale, degree) {
  const n = scale.length, oct = Math.floor(degree / n);
  return oct * 12 + scale[degree - oct * n];
}

/**
 * Returns {tokens, marks, events, duration}.
 *  marks:  [{time, end}]  text revealed up to UTF-16 offset `end` at `time` (for the typewriter)
 *  events: [{time, unit, hz, glide, gain, maxDuration, token}]
 */
export function plan(text, voiceInput = {}) {
  const voice = resolveVoice(voiceInput);
  const seed = voice.seed ?? hashString(text);
  const rTime = createRandom(seed), rMelody = createRandom(seed ^ 0x9e3779b9);
  const tokens = tokenize(text);
  const tempo = voice.tempo > 0 ? voice.tempo : 1;
  const textRate = voice.textRate * tempo, speed = voice.speed * tempo;
  const slot = 1 / (speed * ENGLISH_VOICE_RATE);

  // 1. Text clock.
  const marks = [], units = []; // units: {index, reveal, sentence}
  let t = 0, lastPause = 0, sentence = 0, sentenceHasUnits = false;
  const endings = new Map(); // sentence -> 'period' | 'question' | 'exclaim' ...
  tokens.forEach((tok, index) => {
    marks.push({ time: t, end: tok.end });
    if (tok.kind === 'pause') {
      const p = (voice.pauses[tok.pause] ?? 0) / tempo;
      t += Math.max(0, p - lastPause); // "?!" pauses for the longest, not the sum
      lastPause = Math.max(lastPause, p);
      if (SENTENCE_END.has(tok.pause) && sentenceHasUnits && endings.get(sentence) !== 'question') endings.set(sentence, tok.pause);
    } else if (tok.kind === 'unit') {
      if (endings.has(sentence)) { sentence++; sentenceHasUnits = false; }
      sentenceHasUnits = true;
      lastPause = 0;
      units.push({ index, reveal: t, sentence });
      t += (tok.text.length / CHARS_PER_BEAT) * (1 + (rTime() - 0.5) * 2 * voice.timingJitter) / textRate;
    }
  });
  const textEnd = t;

  // 2. Voice clock: tick, take the latest strong unit revealed so far, skip the rest.
  const onsets = [];
  let tick = -Infinity;
  for (let i = 0; i < units.length;) {
    const at = Math.max(tick, units[i].reveal);
    let j = i;
    while (j < units.length && units[j].reveal <= at + 1e-9) j++;
    const due = units.slice(i, j);
    const strong = due.filter((u) => !tokens[u.index].weak);
    const chosen = (strong.length ? strong : due).at(-1);
    onsets.push({ ...chosen, time: at });
    tick = at + slot;
    i = j;
  }

  // 3. Melody: random walk on the scale, leaning back to centre, falling through each sentence.
  const scale = SCALES[voice.scale] ?? SCALES['major-pentatonic'];
  const range = Math.max(1, Math.round(voice.range * Math.max(voice.variation, 0.5)));
  let degree = 0, position = 0, curSentence = -1;
  const notes = onsets.map((o) => {
    if (o.sentence !== curSentence) { curSentence = o.sentence; degree = 0; position = 0; }
    if (voice.variation > 0 && rMelody() < voice.liveliness) {
      const step = rMelody() < 0.75 ? 1 : 2;
      const up = rMelody() < 0.5 - degree / (2 * range + 1);
      degree = Math.max(-range, Math.min(range, degree + (up ? step : -step)));
    }
    const drop = voice.declination * Math.max(-0.5, 0.5 - position / 8);
    position++;
    const detune = (rMelody() - 0.5) * 2 * voice.jitter * voice.variation;
    return {
      o,
      semitones: degreeToSemitones(scale, degree) * voice.variation + drop + detune,
      gain: voice.volume * (0.85 + 0.15 * rMelody()),
      glide: voice.glide * (0.6 + 0.8 * rMelody()),
    };
  });

  // 4. Sentence tails: questions rise, exclamations lift, over the last TAIL units.
  const bySentence = new Map();
  notes.forEach((n) => { (bySentence.get(n.o.sentence) ?? bySentence.set(n.o.sentence, []).get(n.o.sentence)).push(n); });
  for (const [s, list] of bySentence) {
    const end = endings.get(s);
    const k = Math.min(TAIL, list.length);
    list.forEach((n, i) => {
      const rank = k - (list.length - i) + 1; // 1..k over the last k units
      if (rank <= 0) return;
      const share = rank / k;
      if (end === 'question') n.semitones += voice.questionRise * share;
      else if (end === 'exclaim') { n.semitones += voice.exclaimLift * share; n.gain = Math.min(1, n.gain * 1.15); }
    });
  }

  // 5. Events. A unit rings until its slot ends (or the next onset); the last one may ring longer.
  const events = notes.map((n, i) => {
    const next = notes[i + 1];
    const maxDuration = next ? Math.min(slot * (1 + voice.sustain), next.o.time - n.o.time) : slot * 1.6;
    return {
      time: n.o.time, unit: tokens[n.o.index].unit, token: n.o.index,
      hz: voice.baseHz * 2 ** (n.semitones / 12), glide: n.glide, gain: n.gain, maxDuration,
    };
  });
  const duration = Math.max(textEnd, ...events.map((e) => e.time + e.maxDuration));
  return { voice, tokens, marks, events, duration };
}
