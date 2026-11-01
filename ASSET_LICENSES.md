# Audio asset provenance

| Path | What it is | Origin | Terms | Modifications |
|---|---|---|---|---|
| `banks/ja-nova/` | 101 short Japanese-kana units, one voice | Generated with OpenAI `gpt-4o-mini-tts`, voice **nova**, by the maintainer of moeru-ai/animalese-js (`source` field in `manifest.json`) | Distributed in that MIT-licensed repository; **no separate audio licence is stated there.** Speech API output is assigned to the API customer by OpenAI's terms; OpenAI requires disclosing that the voice is AI-generated. | Silence-trimmed, pitch-flattened (TD-PSOLA), loudness-set by the animalese-js baker. Further trimmed and level-matched at load time by this project (in memory only; the files are unchanged). |
| `banks/ja-onyx/` | same, lower voice | same, voice **onyx** | same | same |

**These are AI-generated voices.** They are not recordings of any person and contain no Nintendo audio.

Status: provenance is documented from the upstream repo's own metadata; the upstream author's intent to permit audio
redistribution has **not** been confirmed in writing. To remove all doubt, replace both banks with ones you record
yourself (`app/record.html`) and delete the folders above, or ask the upstream maintainer for an explicit statement.

Banks placed in `banks_local/` are the user's own responsibility and are never part of this repository.
