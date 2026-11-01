import { synthesize, encodeWav, loadBank, PERSONALITIES, resolveVoice } from '../engine/index.js';
import { VILLAGERS } from '../engine/villagers.js';

const $ = (id) => document.getElementById(id);
const banks = new Map();           // id -> Bank (loaded lazily from the server list)
const bankInfo = new Map();        // id -> {label, path?}
const characters = new Map();      // key -> voice options
let ctx = null, source = null, timer = null, last = null;

const status = (m) => { $('status').textContent = m; };

// ---------- banks ----------
async function loadServerBanks() {
  for (const b of await (await fetch('/api/banks')).json()) bankInfo.set(b.id, { label: b.label + (b.local ? ' (local)' : ''), path: b.path });
  for (const rec of await idbAll().catch(() => [])) { banks.set(rec.manifest.id, loadBank(rec.manifest, rec.sprite)); bankInfo.set(rec.manifest.id, { label: rec.manifest.label + ' (recorded)' }); }
  fillBanks();
}
async function getBank(id) {
  if (banks.has(id)) return banks.get(id);
  const info = bankInfo.get(id);
  if (!info?.path) throw new Error(`bank "${id}" is not available`);
  const manifest = await (await fetch(info.path + 'manifest.json')).json();
  const sprite = new Uint8Array(await (await fetch(info.path + manifest.sprite)).arrayBuffer());
  const bank = loadBank(manifest, sprite); banks.set(id, bank); return bank;
}
function fillBanks(sel = $('bank').value) {
  $('bank').innerHTML = [...bankInfo].map(([id, i]) => `<option value="${id}">${i.label}</option>`).join('');
  if (bankInfo.has(sel)) $('bank').value = sel;
}
// IndexedDB store for banks recorded in the browser (see record.html)
function idb() { return new Promise((res, rej) => { const r = indexedDB.open('animalese', 1); r.onupgradeneeded = () => r.result.createObjectStore('banks', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbAll() { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction('banks').objectStore('banks').getAll(); q.onsuccess = () => res(q.result.map((x) => ({ manifest: x.manifest, sprite: x.sprite }))); q.onerror = () => rej(q.error); }); }
async function idbPut(manifest, sprite) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('banks', 'readwrite'); t.objectStore('banks').put({ id: manifest.id, manifest, sprite }); t.oncomplete = res; t.onerror = () => rej(t.error); }); }

$('bimport').onchange = async (e) => {
  const files = [...e.target.files], mf = files.find((f) => f.name.endsWith('.json')), sp = files.find((f) => f.name.endsWith('.wav'));
  if (!mf || !sp) return status('select manifest.json and sprite.wav together');
  try {
    const manifest = JSON.parse(await mf.text()), sprite = new Uint8Array(await sp.arrayBuffer());
    const bank = loadBank(manifest, sprite); banks.set(bank.id, bank);
    bankInfo.set(bank.id, { label: bank.label + ' (imported)' }); await idbPut(manifest, sprite).catch(() => {});
    fillBanks(bank.id); status(`imported ${bank.id}: ${bank.units.size} units`);
  } catch (err) { status('import failed: ' + err.message); }
};

// ---------- characters & controls ----------
function fillCharacters() {
  for (const [k, p] of Object.entries(PERSONALITIES)) characters.set('p:' + k, { personality: k });
  for (const v of VILLAGERS) characters.set('v:' + v.name, v);
  $('char').innerHTML = '<optgroup label="Personalities">' + Object.entries(PERSONALITIES).map(([k, p]) => `<option value="p:${k}">${p.label}</option>`).join('') +
    '</optgroup><optgroup label="Villagers">' + VILLAGERS.map((v) => `<option value="v:${v.name}">${v.name} (${PERSONALITIES[v.personality].label})</option>`).join('') + '</optgroup>';
}
function applyCharacter(key) {
  const v = resolveVoice(characters.get(key));
  $('hz').value = v.baseHz; $('var').value = v.variation; $('tempo').value = v.tempo; $('seed').value = v.seed ?? '';
  if (bankInfo.has(v.bank)) $('bank').value = v.bank;
  readouts();
}
function readouts() { $('o-hz').textContent = $('hz').value + ' Hz'; $('o-var').textContent = (+$('var').value).toFixed(2); $('o-tempo').textContent = '×' + (+$('tempo').value).toFixed(2); }
function currentVoice() {
  const base = characters.get($('char').value) ?? {};
  return { ...base, bank: $('bank').value, baseHz: +$('hz').value, variation: +$('var').value, tempo: +$('tempo').value, seed: $('seed').value === '' ? null : +$('seed').value };
}
for (const id of ['hz', 'var', 'tempo']) $(id).oninput = readouts;
$('char').onchange = () => applyCharacter($('char').value);
$('dice').onclick = () => { $('seed').value = Math.floor(Math.random() * 100000); };

// ---------- playback ----------
async function render() {
  const voice = currentVoice(), bank = await getBank(voice.bank);
  return synthesize($('text').value, voice, bank, { sampleRate: ctx?.sampleRate ?? 48000 });
}
function stop() {
  clearInterval(timer); timer = null;
  if (source) { source.onended = null; try { source.stop(); } catch {} source = null; }
  status('');
}
$('play').onclick = async () => {
  stop();
  try {
    ctx ??= new AudioContext(); await ctx.resume();
    const r = last = await render();
    const buf = ctx.createBuffer(1, r.samples.length, r.sampleRate); buf.copyToChannel(r.samples, 0);
    source = ctx.createBufferSource(); source.buffer = buf; source.connect(ctx.destination);
    const text = $('text').value, t0 = ctx.currentTime + 0.05; let m = 0;
    source.onended = () => { stop(); $('reveal').textContent = text; };
    source.start(t0);
    $('reveal').textContent = '';
    timer = setInterval(() => {                                // typewriter, driven by the same plan as the audio
      const now = ctx.currentTime - t0;
      while (m < r.plan.marks.length && r.plan.marks[m].time <= now) m++;
      $('reveal').textContent = text.slice(0, r.plan.marks[Math.max(0, m - 1)]?.end ?? 0);
    }, 16);
    status(`${r.plan.events.length} units, ${r.plan.duration.toFixed(1)} s`);
  } catch (err) { status(err.message); }
};
$('stop').onclick = stop;
$('export').onclick = async () => {
  try {
    const r = await render();
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([encodeWav(r.samples, r.sampleRate)], { type: 'audio/wav' })), download: 'animalese.wav' });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (err) { status(err.message); }
};

// ---------- presets ----------
const KEY = 'animalese.presets';
const presets = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
function listPresets() { $('plist').innerHTML = Object.keys(presets()).map((n) => `<option>${n}</option>`).join(''); }
function savePreset(name, p) { try { localStorage.setItem(KEY, JSON.stringify({ ...presets(), [name]: p })); } catch { status('could not save (storage blocked)'); } listPresets(); }
$('psave').onclick = () => { const n = $('pname').value.trim(); if (!n) return status('name the preset'); savePreset(n, { ...currentVoice(), character: $('char').value }); status(`saved "${n}"`); };
$('pload').onclick = () => {
  const p = presets()[$('plist').value]; if (!p) return;
  if (p.character && characters.has(p.character)) $('char').value = p.character;
  characters.set('custom', p); applyPreset(p);
};
function applyPreset(p) {
  const v = resolveVoice(p);
  $('hz').value = v.baseHz; $('var').value = v.variation; $('tempo').value = v.tempo; $('seed').value = p.seed ?? '';
  if (bankInfo.has(v.bank)) $('bank').value = v.bank; readouts();
}
$('pdel').onclick = () => { const all = presets(); delete all[$('plist').value]; try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {} listPresets(); };
$('pexport').onclick = () => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify({ ...currentVoice(), character: $('char').value }, null, 2)], { type: 'application/json' })), download: ($('pname').value || 'voice') + '.json' });
  a.click();
};
$('pimport').onchange = async (e) => {
  try { const p = JSON.parse(await e.target.files[0].text()); savePreset(e.target.files[0].name.replace(/\.json$/, ''), p); applyPreset(p); status('preset imported'); } catch { status('not a valid preset file'); }
};

// ---------- init ----------
fillCharacters(); listPresets();
loadServerBanks().then(() => applyCharacter($('char').value)).catch((err) => status('could not list banks: ' + err.message));
