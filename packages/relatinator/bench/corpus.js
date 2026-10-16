// A deterministic synthetic corpus for the equivalence test and the
// benchmark. The same size, seed, and lengths always give the same
// documents, so results and checksums can be compared between runs.

/** @typedef {{ id: string, content: string }} Doc */
/** @typedef {{ seed?: number, minWords?: number, maxWords?: number }} CorpusOptions */

/** @param {number} seed */
export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @typedef {() => number} Random */

/**
 * @template T
 * @param {Random} random
 * @param {readonly T[]} items
 * @returns {T}
 */
function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

/** @param {Random} random @param {number} min @param {number} max */
function between(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

const STOP = (
  "the of and to a in is it that was for on with as be at by this have " +
  "from or an are but they which you were all we when there would their " +
  "so if about what up out them into has more her him he she its our do " +
  "does did i me my been being had having these those am than too very"
).split(" ");

const HEAD = (
  "time people year way day thing world life hand part child eye place " +
  "work week case point government company number group problem fact " +
  "javascript typescript react astro node server component function " +
  "performance database query render build deploy test cache browser " +
  "framework library module package error user design data code " +
  "developer community open source conference talk speaker meetup " +
  "content collection related post article blog markdown search index " +
  "ranking score term document model stemmer token language english " +
  "science book space summer autumn spring winter planet star galaxy " +
  "history music coffee travel city mountain river ocean garden kitchen " +
  "recipe bread cheese wine dinner family friend story write read learn " +
  "teach school student teacher question answer idea plan project team " +
  "product market price money business customer service support issue " +
  "release version update change feature bug fix review merge branch " +
  "commit tests linting formatting types interface generic compiler " +
  "runtime memory thread worker process network request response route " +
  "page layout style color font image video audio camera photo light " +
  "dark theme mobile desktop screen keyboard mouse touch scroll click " +
  "running connected connections connecting happily happiness argued " +
  "arguing generously generalization organization organizational"
).split(" ");

const SPECIAL = [
  "café",
  "naïve",
  "résumé",
  "Zürich",
  "straße",
  "Fußball",
  "São",
  "Ελλάδα",
  "Привет",
  "мир",
  "東京",
  "日本語",
  "İstanbul",
  "ǅemal",
  "crème",
  "brûlée",
  "façade",
  "coöperate",
  "piñata",
  "Ångström",
  "ﬁle",
  "Œuvre",
  "smörgåsbord",
  "don't",
  "it's",
  "we've",
  "they'll",
  "I'm",
  "she'd",
  "isn't",
  "can't",
  "won't",
  "o'clock",
  "rock'n'roll",
  "y'all",
  "ma'am",
  "it’s",
  "we’re",
  "Darko's",
  "James'",
  "'90s",
  "'tis",
  "constructor",
  "prototype",
  "__proto__",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "state-of-the-art",
  "e-mail",
  "node.js",
  "C++",
  "C#",
  "foo_bar",
  "x86-64",
];

const ONSETS =
  "b bl br c ch cl cr d dr f fl fr g gl gr h j k l m n p pl pr qu r s sh sk sl sp st str t th tr v w wh z".split(
    " "
  );
const VOWELS = "a e i o u ai ea ee oo ou ie".split(" ");
const CODAS = ",n,r,s,t,l,nd,st,ng,ck,m,rt,sh,x".split(",");
const SUFFIXES = ",,,s,ed,ing,er,ly,tion,ness,ment,able,ist,ism,ful".split(",");

/** @param {Random} random */
function pseudoWord(random) {
  let word = "";
  const syllables = between(random, 1, 3);
  for (let i = 0; i < syllables; i++) {
    word += pick(random, ONSETS) + pick(random, VOWELS) + pick(random, CODAS);
  }
  return word + pick(random, SUFFIXES);
}

/** @param {Random} random @param {number} count @param {string} prefix */
function pseudoWords(random, count, prefix) {
  const words = new Set();
  while (words.size < count) words.add(prefix + pseudoWord(random));
  return [...words];
}

/** Content words in rank order: real words first, a long tail after. */
function contentVocabulary() {
  const random = createRandom(0x5eed);
  const words = [...HEAD];
  const tail = pseudoWords(random, 20000, "");
  for (let i = 0; i < tail.length; i++) {
    if (i % 41 === 7) words.push(SPECIAL[Math.floor(i / 41) % SPECIAL.length]);
    words.push(tail[i]);
  }
  return words;
}

/** @param {number} size @param {number} exponent */
function zipfTable(size, exponent) {
  const cumulative = new Float64Array(size);
  let total = 0;
  for (let rank = 0; rank < size; rank++) {
    total += 1 / Math.pow(rank + 1, exponent);
    cumulative[rank] = total;
  }
  return cumulative;
}

/** @param {Random} random @param {Float64Array} cumulative */
function zipfIndex(random, cumulative) {
  const target = random() * cumulative[cumulative.length - 1];
  let low = 0;
  let high = cumulative.length - 1;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (cumulative[mid] < target) low = mid + 1;
    else high = mid;
  }
  return low;
}

const VOCABULARY = contentVocabulary();
const VOCABULARY_ZIPF = zipfTable(VOCABULARY.length, 1.05);
const STOP_ZIPF = zipfTable(STOP.length, 0.8);
const TOPIC_WORDS = VOCABULARY.slice(150);
const TOPICS = Array.from({ length: 24 }, (_, topic) => {
  const random = createRandom(1000 + topic);
  return Array.from({ length: 150 }, () => pick(random, TOPIC_WORDS));
});
const TOPIC_ZIPF = zipfTable(150, 0.9);
const ISOLATED = pseudoWords(createRandom(0x1501), 40, "zq");

/** @param {Random} random */
function numberToken(random) {
  const forms = [
    () => String(between(random, 1990, 2030)),
    () => String(between(random, 0, 999)),
    () => `${between(random, 0, 9)}.${between(random, 0, 99)}`,
    () => `${between(random, 1, 9)},${between(random, 100, 999)}`,
    () => `v${between(random, 1, 5)}.${between(random, 0, 9)}`,
    () => `${between(random, 2, 99)}x`,
  ];
  return pick(random, forms)();
}

/** @param {Random} random @param {readonly string[][]} topics */
function contentWord(random, topics) {
  if (random() < 0.25) {
    return pick(random, topics)[zipfIndex(random, TOPIC_ZIPF)];
  }
  return VOCABULARY[zipfIndex(random, VOCABULARY_ZIPF)];
}

/** @param {Random} random @param {readonly string[][]} topics */
function word(random, topics) {
  const roll = random();
  if (roll < 0.33) return STOP[zipfIndex(random, STOP_ZIPF)];
  if (roll < 0.35) return numberToken(random);
  if (roll < 0.355) return `https://example.com/${contentWord(random, topics)}`;
  if (roll < 0.36) {
    return `${contentWord(random, topics)}-${contentWord(random, topics)}`;
  }
  return contentWord(random, topics);
}

const DECORATIONS = [
  (/** @type {string} */ w) => `${w},`,
  (/** @type {string} */ w) => `“${w}”`,
  (/** @type {string} */ w) => `(${w})`,
  (/** @type {string} */ w) => `**${w}**`,
  (/** @type {string} */ w) => `\`${w}\``,
  (/** @type {string} */ w) => `${w} —`,
];
const ENDINGS = [". ", ". ", ". ", "? ", "! ", "… ", ".\n\n", ".\n\n## "];

/** @param {Random} random @param {string} w */
function decorate(random, w) {
  return random() < 0.12 ? pick(random, DECORATIONS)(w) : w;
}

/** @param {Random} random @param {number} words @param {readonly string[][]} topics */
function text(random, words, topics) {
  const parts = [];
  let sentence = 0;
  for (let i = 0; i < words; i++) {
    const w = word(random, topics);
    const first = sentence === 0;
    parts.push(decorate(random, first ? w[0].toUpperCase() + w.slice(1) : w));
    sentence++;
    const last = i === words - 1;
    const end = last || (sentence >= 4 && random() < 0.12);
    parts.push(end ? pick(random, ENDINGS) : " ");
    if (end) sentence = 0;
  }
  return parts.join("").trimEnd();
}

/** @param {Random} random @param {number} min @param {number} max */
function logUniform(random, min, max) {
  return Math.round(min * Math.pow(max / min, random()));
}

/** @param {Random} random @param {string} content */
function nearDuplicate(random, content) {
  const words = content.split(" ");
  const swaps = between(random, 1, 3);
  for (let i = 0; i < swaps; i++) {
    words[Math.floor(random() * words.length)] = pick(random, HEAD);
  }
  return words.join(" ");
}

const ODD_IDS = [
  "__proto__",
  "constructor",
  "toString",
  "10",
  "2",
  "01",
  "",
  "café ünïcode id",
  "has spaces",
];

/** @param {Random} random @param {readonly Doc[]} docs @param {number} min @param {number} max */
function regularContent(random, docs, min, max) {
  const roll = random();
  if (docs.length > 0 && roll < 0.02) return pick(random, docs).content;
  if (docs.length > 0 && roll < 0.07) {
    return nearDuplicate(random, pick(random, docs).content);
  }
  const topics = [pick(random, TOPICS), pick(random, TOPICS)];
  return text(random, logUniform(random, min, max), topics);
}

/** @param {Random} random @param {readonly Doc[]} docs */
function specialDocs(random, docs) {
  const base = docs[0].content;
  return [
    { id: "empty", content: "" },
    {
      id: "stopwords-only",
      content:
        "The and of to a in is it that was. It is what it is, and that's all!",
    },
    { id: "punctuation-only", content: "!!! ??? ... — 🚀🚀 *** ---" },
    { id: "dup-a", content: base },
    { id: "dup-b", content: base },
    { id: "near-dup", content: nearDuplicate(random, base) },
    {
      id: "isolated",
      content: Array.from({ length: 60 }, () => pick(random, ISOLATED)).join(
        " "
      ),
    },
    { id: "one-word", content: "node node Node NODE." },
  ];
}

/**
 * Returns `size` documents. From 20 documents on, the corpus also holds
 * an empty document, a stopwords-only document, exact and near
 * duplicates, a document that shares no terms with the rest, and ids
 * such as "__proto__", "10", and "".
 *
 * @param {number} size
 * @param {CorpusOptions} [options]
 * @returns {Doc[]}
 */
export function generateCorpus(size, options = {}) {
  const { seed = 1, minWords = 20, maxWords = 2000 } = options;
  const random = createRandom(seed);
  /** @type {Doc[]} */
  const docs = [];
  for (let i = 0; i < size; i++) {
    const content = regularContent(random, docs, minWords, maxWords);
    docs.push({ id: `post-${i}`, content });
  }
  if (size < 20) return docs;
  const specials = specialDocs(random, docs);
  const slots = specials.length + ODD_IDS.length;
  const slotOf = (/** @type {number} */ k) =>
    Math.floor(((k + 1) * size) / (slots + 1));
  specials.forEach((doc, k) => {
    docs[slotOf(k)] = doc;
  });
  ODD_IDS.forEach((id, k) => {
    const slot = slotOf(specials.length + k);
    docs[slot] = { id, content: docs[slot].content };
  });
  return docs;
}
