# R-Babble

Type dialogue, pick a character, hear Animal Crossing-style "Animalese" babble. **Unofficial fan project, not affiliated with Nintendo.** Needs Node 18+ and a browser. No dependencies.

```bash
./run.sh            # starts the server and opens http://127.0.0.1:8765/
tools/make-launcher.sh   # optional: desktop icon
npm test            # automated checks (below)
node tools/render.mjs "Hello! Welcome to my island!" --voice peppy --out out/peppy.wav
node tools/measure.mjs reference.wav out/peppy.wav     # compare rhythm/pitch with a clip you own
```

## How it works (adapted from moeru-ai/animalese-js, see RESEARCH.md)

1. **Text to units.** Each English syllable maps to the nearest kana unit (the game is believed to use one shared kana bank).
2. **Two clocks.** The "dialogue box" reveals text at ~55 letters/s; the voice ticks at 13.6 units/s and *skips* units it can't
   keep up with (weak words like "the" first). `tempo` scales both; punctuation adds pauses.
3. **Melody.** Per sentence: a random walk on a musical scale, gentle fall, `?` rises, `!` lifts, small per-unit detune. Seeded, so repeatable.
4. **Playback.** Each unit is the bank sample resampled to the target pitch (`hz / referenceHz`) with a slight downward glide,
   faded, level-matched over the part actually heard, and mixed into one Float32 buffer. What you hear is exactly what Export WAV writes.

`engine/` is pure JS with no DOM or Node APIs; `app/` is the UI; `tools/` and `test/` run in Node.

## Characters

Eight personalities (Normal, Peppy, Snooty, Big Sister, Lazy, Jock, Cranky, Smug) plus 24 generated villagers
(`engine/villagers.js`: personality x name-derived pitch/tempo/variation). Save your own in the UI (browser storage, or Export/Import JSON).

## Voicebanks

- Bundled: `ja-nova` (higher, reference 175 Hz) and `ja-onyx` (lower, 98 Hz): AI-synthesised kana, pitch-flattened.
  **They are not recordings of the game**, so the timbre is not Nintendo's.
- **Your own bank:** open *Record a bank* (`app/record.html`). Say 46 (or 80) short kana; it trims, levels and flattens pitch, saves
  to the browser and downloads `manifest.json` + `sprite.wav`.
- **Any bank:** a folder with `manifest.json` (`animalese-bank@1`) + `sprite.wav` goes in `banks_local/<name>/`, or use *Import bank*.
  Make sure you have the rights to anything you import.

## What was verified (and what was not)

`npm test` renders the 5 test sentences x 8 personalities and checks: finite samples, no clipping, click score, unit-to-unit level
spread <= 8 dB (measured 1.4-6.3), in-phrase rate 10-18 units/s (normal voice 12.6-13.6), distinct mean pitch per voice (>= 8 Hz apart),
same seed gives identical audio, tempo 1.4 clearly faster than 0.7, `?` pitch above `.`, pause order none < comma < period. It also runs a
recorder round-trip with detuned units (flatten error 0.06 semitones). Headless Firefox confirmed the UI loads with its banks.

**Not done:**
- **Nobody has listened to this.** All checks are measurements; whether it *sounds* like New Horizons needs your ears.
- **No comparison with real New Horizons audio.** I have none and cannot ship it. `tools/measure.mjs` is for that (validated against the
  renderer's known unit counts). Expect to tune `engine/voice.js`.
- Browser playback, export and the recorder were not run with sound hardware or a microphone; they call the same engine functions the tests cover.
- Only 3 of the personality pitches are measured data; the rest are estimates.
- With two bundled timbres, personalities sharing a bank differ by pitch, pace and melody, not vocal character. More banks give more distinct voices.

## Legal

- Code: MIT (`LICENSE`). Adapted parts of animalese-js: `THIRD_PARTY_NOTICES.md`. Audio provenance: `ASSET_LICENSES.md`.
- Bundled voices are **AI-generated** (OpenAI TTS via animalese-js); no Nintendo audio is included or distributed.
- Users are responsible for ensuring they have the necessary rights to any voicebank they import. This project does not provide,
  endorse, or distribute copyrighted audio extracted from commercial games.
- `npm run prepublish-check` fails if the repo contains anything that should not be published.

## Not implemented (per scope)

"First letter of each word" letter mode (older games), other languages, streaming text input.
