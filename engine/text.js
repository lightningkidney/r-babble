// English text -> tokens. Each syllable maps to the nearest Japanese kana unit, which is how
// the game's shared kana voicebank is believed to voice English (see RESEARCH.md).
// Syllable rules adapted from moeru-ai/animalese-js (MIT).

export const KANA = new Set(('a i u e o ka ki ku ke ko sa shi su se so ta chi tsu te to na ni nu ne no ' +
  'ha hi fu he ho ma mi mu me mo ya yu yo ra ri ru re ro wa n ga gi gu ge go za ji zu ze zo da de do ' +
  'ba bi bu be bo pa pi pu pe po kya kyu kyo sha shu sho cha chu cho nya nyu nyo hya hyu hyo mya myu myo ' +
  'rya ryu ryo gya gyu gyo ja ju jo bya byu byo pya pyu pyo').split(' '));

const CONSONANTS = {
  b: 'b', c: 'k', d: 'd', f: 'h', g: 'g', h: 'h', j: 'j', k: 'k', l: 'r', m: 'm', n: 'n', p: 'p',
  q: 'k', r: 'r', s: 's', t: 't', v: 'b', w: 'w', x: 'z', y: 'y', z: 'z',
  sh: 'sh', ch: 'ch', th: 's', ph: 'h', wh: 'w', ck: 'k', qu: 'k', gh: 'g',
};

// English vowel spellings folded onto the five kana vowels.
const VOWELS = [
  [/^(?:ee|ea|ie|ey|i|y)/, 'i'],
  [/^(?:oo|ou|ew|ue|u)/, 'u'],
  [/^(?:ai|ay|ei|e)/, 'e'],
  [/^(?:oa|ow|oe|au|aw|oi|oy|o)/, 'o'],
  [/^a/, 'a'],
];

// Combinations Japanese lacks.
const FIXES = {
  si: 'shi', ti: 'chi', tu: 'tsu', hu: 'fu', zi: 'ji', di: 'ji', du: 'zu',
  wi: 'i', we: 'e', wo: 'o', wu: 'u', yi: 'i', ye: 'e', she: 'shi', che: 'chi', je: 'ji',
};

// Unstressed words: the voice drops these first when the text outruns it.
const WEAK = new Set(['a', 'an', 'the', 'of', 'to', 'and', 'or', 'in', 'on', 'at', 'is', 'it', 'as', 'for', 'but', 'be', 'was', 'are']);
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

const PAUSES = {
  ' ': 'space', '\t': 'space', ',': 'comma', ';': 'comma', ':': 'comma', '-': 'comma', '—': 'comma', '~': 'comma',
  '.': 'period', '?': 'question', '!': 'exclaim', '…': 'ellipsis', '\n': 'newline',
};

function toKana(onset, nucleus, direct = true) {
  const vowel = (VOWELS.find(([re]) => re.test(nucleus)) || [, 'a'])[1];
  let c = onset ? CONSONANTS[onset] ?? CONSONANTS[onset[0]] ?? '' : '';
  if (direct && /^[ei]/.test(nucleus) && onset === 'c') c = 's';  // soft c/g only right before e/i/y
  if (direct && /^[ei]/.test(nucleus) && onset === 'g') c = 'j';
  const name = FIXES[c + vowel] ?? c + vowel;
  return KANA.has(name) ? name : vowel;
}

function onsetConsonant(cluster) {
  const body = /^s[ptk]/.test(cluster) ? cluster.slice(1) : cluster; // "star" -> "ta"
  const di = body.slice(0, 2);
  return CONSONANTS[di] && di.length === 2 ? di : body.slice(0, 1);
}

/** One syllable per vowel group, minus silent final e / -ed / -es. Returns [{kana,start,end}]. */
export function syllabify(word) {
  const w = word.toLowerCase();
  const groups = [...w.matchAll(/[aeiou]+|(?<=[^aeiou])y(?![aeiou])/g)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
  // "-ing" is its own syllable even after a vowel ("do-ing", "be-ing").
  if (/[aeiou]ing$/.test(w) && w.length > 4) {
    const i = w.length - 3, g = groups.find((x) => x.start <= i && x.end > i);
    if (g && g.start < i) { g.end = i; groups.splice(groups.indexOf(g) + 1, 0, { start: i, end: i + 1 }); }
  }
  if (groups.length > 1) {
    const last = groups.at(-1);
    const ending = w.slice(last.start);
    const before = w[last.start - 1] ?? '';
    const silentE = ending === 'e' && !/[^aeiou]le$/.test(w);
    const silentEd = ending === 'ed' && !/[td]$/.test(before);
    const silentEs = ending === 'es' && !/(?:[sxz]|ch|sh|[cg])$/.test(w.slice(0, last.start));
    if (silentE || silentEd || silentEs) groups.pop();
  }
  if (groups.length === 0) return [{ kana: toKana(onsetConsonant(w), 'a'), start: 0, end: word.length }];
  const out = groups.map((g, i) => {
    const prevEnd = i === 0 ? 0 : groups[i - 1].end;
    const cluster = w.slice(prevEnd, g.start);
    const onset = i === 0 ? onsetConsonant(cluster)
      : cluster.length >= 2 && CONSONANTS[cluster.slice(-2)] ? cluster.slice(-2) : cluster.slice(-1);
    return { kana: toKana(onset, w.slice(g.start, g.end), cluster.length <= onset.length), start: i === 0 ? 0 : g.start - onset.length, end: word.length };
  });
  out.forEach((s, i) => { s.end = out[i + 1]?.start ?? word.length; });
  return out;
}

/**
 * Text -> tokens. unit tokens: {kind:'unit', unit:'ja/ka', weak, text, start, end};
 * pause tokens: {kind:'pause', pause}; silent tokens are shown but not voiced.
 */
export function tokenize(text) {
  const tokens = [];
  const chars = [...text];
  let pos = 0; // UTF-16 offset
  const offs = chars.map((c) => { const o = pos; pos += c.length; return o; });
  for (let i = 0; i < chars.length;) {
    const ch = chars[i], start = offs[i];
    if (/\d/.test(ch)) {
      for (const s of syllabify(DIGITS[+ch])) tokens.push({ kind: 'unit', unit: 'ja/' + s.kana, text: ch, start, end: start + 1, lang: 'en' });
      i++;
    } else if (/\p{Script=Latin}/u.test(ch)) {
      let j = i;
      while (j < chars.length && (/\p{Script=Latin}/u.test(chars[j]) || (chars[j] === "'" && /\p{Script=Latin}/u.test(chars[j + 1] ?? '')))) j++;
      const word = chars.slice(i, j).join('');
      const plain = word.normalize('NFD').replace(/\p{M}/gu, '').replace(/'/g, '');
      const weak = WEAK.has(plain.toLowerCase());
      for (const s of syllabify(plain)) {
        tokens.push({ kind: 'unit', unit: 'ja/' + s.kana, text: word.slice(s.start, s.end), start: start + s.start, end: start + s.end, weak, lang: 'en' });
      }
      i = j;
    } else {
      const p = PAUSES[ch];
      tokens.push(p ? { kind: 'pause', pause: p, text: ch, start, end: start + ch.length } : { kind: 'silent', text: ch, start, end: start + ch.length });
      i++;
    }
  }
  return tokens;
}
