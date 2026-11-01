# Research notes

(Written when the project was called "Animalese Synth"; the project is now R-Babble.)

Clones of the five reference projects were read (`research/`, git-ignored). Findings are what the code and READMEs
show; I have not listened to any of them.

## The five projects

| Project | Approach | Audio source | Code licence | Audio licence | Verdict |
|---|---|---|---|---|---|
| **moeru-ai/animalese-js** | Short units (kana morae), flat pitch, one playback rate per unit; two clocks (text reveal vs. voice ticks, skips units); melody snapped to a scale; sentence declination, `?` rise, `!` lift. **Timing and pitch calibrated on real ACNH recordings** (English voice 13-14 units/s, units 70-140 ms, near-flat pitch with a small fall). | Baked from OpenAI `gpt-4o-mini-tts` (nova/onyx), TD-PSOLA-flattened, loudness-set | MIT | Not stated separately; AI-generated, no Nintendo audio | **Chosen pipeline.** Best documented, the only one measured against the game. |
| stavrosandres44/Animalese-TTS | One clip per letter, fixed 120 ms step, 55 ms space | `.aac` clips "ripped directly from the game" | **None** | **Nintendo's** | Closest *timbre*, but unlicensed and copyrighted: **not used, not copied.** Naive scheduler (no skipping, pitch or melody). |
| izure1/animalese-tts | Sprite WAV, auto-slice, pitch and sine melody per unit, EN/JA/KO analysers | Own sprites (13 s English = ~450 ms letter-name utterances) | MIT | Not stated | Good design (sampler/effect/player split). English units are too long and word-like. Not used. |
| stefanlegg/animalese-web | 26 letters x 150 ms in one 8-bit 44.1 kHz WAV; `playbackRate` pitch with random variation; 75 ms per letter; first letter of each word only | Inherited from Acedio/animalese.js | MIT | **Unclear** (provenance undocumented) | Simplest proven approach (older-games style). **I measured its bank: F, S, T, V, X, Z are essentially silent** (RMS < 0.02), so it cannot meet "every output clearly audible". Not bundled. |
| brsgr/animalese-generator | Record your own 26 letters in-browser, trim, then speed/pitch/EQ/distortion at playback | User recordings | (repo) | n/a | Source of the recording-workflow idea. Effects chain is out of scope. |

## Which sounds closest to New Horizons?

- By *timbre*: Animalese-TTS (it plays game rips). Unusable for licensing reasons.
- By *behaviour* (rhythm, pitch, melody, skipping): animalese-js. Only it has numbers from ACNH recordings.
- animalese-js's finding that the game voices English through **one shared kana bank, about one unit per syllable** is what this project implements.

## Villager personalities

Hard data exists for three villagers only (animalese-js, measured): cranky ~115 Hz, smug ~330 Hz, lazy ~445 Hz.
All other preset values (peppy 520, snooty 470, big sister 300, jock 220, normal 400 Hz; tempo, scale, glide per
personality) are **estimates**. Pitch differs by individual villager as well as personality, so
`engine/villagers.js` offsets each villager from its personality. Calibrate with `tools/measure.mjs` on clips you own.

## Licensing of what is in this repo

- Engine, app, tools: MIT. Syllable rules and the two-clock/melody model are adapted from animalese-js (MIT); see `THIRD_PARTY_NOTICES.md`.
- `banks/ja-nova`, `banks/ja-onyx`: copied from animalese-js (MIT repo). The audio is TTS output with no Nintendo audio. The
  repo gives no separate audio licence and OpenAI asks that synthetic voice be disclosed as AI-generated. Treat as
  "use freely, disclose AI origin"; not legally verified.
- **No game-extracted audio is included or fetched.** Put any such bank in `banks_local/` (git-ignored) for private study only.
