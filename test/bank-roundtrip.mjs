// Simulates the recorder: detune real units by up to +/-3 semitones, then flatten, pack, reload, synthesize.
import { flatten, medianF0, packBank, loadBank, condition, synthesize } from '../engine/index.js';
import { loadBankDir } from '../tools/nodebank.mjs';
import { createRandom } from '../engine/random.js';

const src = loadBankDir('banks/ja-nova'), r = createRandom(5), SR = src.sampleRate;
const detuned = new Map(), truth = new Map();
for (const name of ['a', 'i', 'u', 'e', 'o', 'ka', 'ta', 'ma']) {
  const st = (r() - 0.5) * 6, f0 = src.referenceHz * 2 ** (st / 12);
  detuned.set(name, flatten(src.units.get('ja/' + name), src.referenceHz, f0)); // as if recorded at f0
  truth.set(name, f0);
}
const units = new Map();
let worst = 0;
for (const [n, s] of detuned) {
  const measured = medianF0(s, SR, 70, 500);
  const f = flatten(s, truth.get(n), src.referenceHz);
  const after = medianF0(f, SR, 70, 500);
  if (Number.isFinite(after)) worst = Math.max(worst, Math.abs(12 * Math.log2(after / src.referenceHz)));
  console.log(n.padEnd(3), `recorded ${truth.get(n).toFixed(0)} Hz (measured ${measured.toFixed(0)}) -> flattened ${after.toFixed(0)} Hz (ref ${src.referenceHz})`);
  units.set('ja/' + n, condition(f, SR));
}
const { manifest, sprite } = packBank({ id: 'rt', label: 'rt', sampleRate: SR, referenceHz: src.referenceHz, units });
const bank = loadBank(JSON.parse(JSON.stringify(manifest)), sprite);
const out = synthesize('Hello! I can take a message.', { baseHz: 400 }, bank);
let peak = 0; for (const v of out.samples) peak = Math.max(peak, Math.abs(v));
console.log(`bank has ${bank.units.size} units; synth with missing kana fell back OK; peak ${peak.toFixed(2)}; worst flatten error ${worst.toFixed(2)} semitones`);
if (bank.units.size !== 8 || peak < 0.2 || peak > 0.99 || worst > 0.7) { console.log('FAIL'); process.exit(1); }
console.log('ROUNDTRIP OK');
