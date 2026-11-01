import { condition, medianF0, flatten, packBank, loadBank } from '../engine/index.js';

const BASIC = 'a i u e o ka ki ku ke ko sa shi su se so ta chi tsu te to na ni nu ne no ha hi fu he ho ma mi mu me mo ya yu yo ra ri ru re ro wa n'.split(' ');
const FULL = [...BASIC, ...'ga gi gu ge go za ji zu ze zo da de do ba bi bu be bo pa pi pu pe po sha shu sho cha chu cho ja ju jo'.split(' ')];
const SR = 24000;
const $ = (id) => document.getElementById(id);
const takes = new Map(); // unit -> {samples, f0}
let ctx, stream;

function draw(canvas, s) {
  const g = canvas.getContext('2d'), w = (canvas.width = canvas.clientWidth * 2), h = (canvas.height = 56);
  g.clearRect(0, 0, w, h); g.strokeStyle = getComputedStyle(document.body).color; g.beginPath();
  for (let x = 0; x < w; x++) { const i = Math.floor((x / w) * s.length); g.lineTo(x, h / 2 - s[i] * h * 0.9); }
  g.stroke();
}
function play(s) { const b = ctx.createBuffer(1, s.length, SR); b.copyToChannel(s, 0); const n = ctx.createBufferSource(); n.buffer = b; n.connect(ctx.destination); n.start(); }

async function record(unit, row) {
  ctx ??= new AudioContext({ sampleRate: SR });
  stream ??= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const rec = new MediaRecorder(stream), chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start(); row.rec.textContent = '● say it…'; await new Promise((r) => setTimeout(r, 1100)); rec.stop(); await done;
  const buf = await ctx.decodeAudioData(await new Blob(chunks).arrayBuffer());
  const raw = buf.getChannelData(0).slice();
  // Cut to the loudest ~350 ms, then trim silence and level it.
  let pk = 0, at = 0; raw.forEach((v, i) => { if (Math.abs(v) > pk) { pk = Math.abs(v); at = i; } });
  if (pk < 0.02) { row.info.textContent = 'too quiet — try again'; row.info.className = 'warn'; return; }
  const seg = raw.slice(Math.max(0, at - Math.floor(0.2 * SR)), Math.min(raw.length, at + Math.floor(0.25 * SR)));
  const s = condition(seg, SR), f0 = medianF0(s, SR, 70, 500);
  takes.set(unit, { samples: s, f0 });
  draw(row.canvas, s); row.rec.textContent = '● re-record';
  row.info.textContent = `${Math.round((s.length / SR) * 1000)} ms, ${Number.isFinite(f0) ? Math.round(f0) + ' Hz' : 'pitch?'}`;
  row.info.className = s.length / SR > 0.3 ? 'warn' : 'ok';
}

function build() {
  $('list').innerHTML = '';
  for (const unit of $('set').value === 'full' ? FULL : BASIC) {
    const li = document.createElement('li');
    li.innerHTML = `<b>${unit}</b><button class="rec">● record</button><button class="pl">▶</button><canvas></canvas><span class="info"></span>`;
    const row = { rec: li.querySelector('.rec'), info: li.querySelector('.info'), canvas: li.querySelector('canvas') };
    row.rec.onclick = () => record(unit, row).catch((e) => { row.info.textContent = e.message; row.info.className = 'warn'; });
    li.querySelector('.pl').onclick = () => takes.has(unit) && play(takes.get(unit).samples);
    $('list').append(li);
    if (takes.has(unit)) { draw(row.canvas, takes.get(unit).samples); row.rec.textContent = '● re-record'; }
  }
}

$('set').onchange = build; build();
$('build').onclick = async () => {
  const need = ($('set').value === 'full' ? FULL : BASIC).filter((u) => !takes.has(u));
  if (need.length) return ($('status').textContent = `still missing: ${need.slice(0, 8).join(' ')}${need.length > 8 ? ' …' : ''}`);
  const f0s = [...takes.values()].map((t) => t.f0).filter(Number.isFinite).sort((a, b) => a - b);
  const ref = Math.round(f0s[Math.floor(f0s.length / 2)] * 100) / 100;
  const units = new Map(); let far = 0;
  for (const [u, t] of takes) {
    const f0 = Number.isFinite(t.f0) && Math.abs(12 * Math.log2(t.f0 / ref)) < 5 ? t.f0 : ref; // distrust wild pitch estimates
    if (Math.abs(12 * Math.log2(f0 / ref)) > 3) far++;
    units.set('ja/' + u, condition(flatten(t.samples, f0, ref), SR));
  }
  const id = $('name').value.trim().replace(/[^\w-]+/g, '-') || 'my-voice';
  const { manifest, sprite } = packBank({ id, label: id, sampleRate: SR, referenceHz: ref, units });
  loadBank(manifest, sprite); // validates what we are about to save
  const db = await new Promise((res, rej) => { const r = indexedDB.open('animalese', 1); r.onupgradeneeded = () => r.result.createObjectStore('banks', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise((res, rej) => { const t = db.transaction('banks', 'readwrite'); t.objectStore('banks').put({ id, manifest, sprite }); t.oncomplete = res; t.onerror = () => rej(t.error); });
  for (const [name, data, type] of [['manifest.json', JSON.stringify(manifest, null, 2), 'application/json'], ['sprite.wav', sprite, 'audio/wav']]) {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([data], { type })), download: name }); a.click();
  }
  $('status').textContent = `saved "${id}" (ref ${ref} Hz${far ? `, ${far} units were >3 semitones off — re-record those for best quality` : ''}). It now appears in the synth; the downloaded files can go in banks_local/${id}/.`;
};
