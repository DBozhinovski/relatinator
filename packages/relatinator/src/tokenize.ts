import stem from "wink-porter2-stemmer";
import { STOPWORDS } from "./stopwords.js";

const ELISION =
  /(?<=[\p{L}\p{N}])(?:n['’]t|['’](?:s|re|ll|ve|d|m))(?![\p{L}\p{N}])/gu;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

// Words repeat far more often than new ones appear, so each distinct word is
// stemmed once. Clearing at a fixed size bounds memory for long-lived callers.
const MAX_CACHED_WORDS = 100_000;
const tokenByWord = new Map<string, string>();

function tokenOf(word: string): string {
  let token = tokenByWord.get(word);
  if (token === undefined) {
    if (tokenByWord.size >= MAX_CACHED_WORDS) tokenByWord.clear();
    // A long substring can keep its whole source text alive; cache a copy.
    const key = (" " + word).slice(1);
    token = STOPWORDS.has(key) ? "" : stem(key);
    tokenByWord.set(key, token);
  }
  return token;
}

// Same test as /[\p{L}\p{N}]/u, without a regex call for ASCII.
function isWordCharacter(code: number): boolean {
  if (code >= 0x80) return WORD_CHARACTER.test(String.fromCodePoint(code));
  return (
    (code >= 0x61 && code <= 0x7a) ||
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x30 && code <= 0x39)
  );
}

// Splits on every code point outside \p{L}\p{N}, as split(/[^\p{L}\p{N}]+/u)
// does, but without a regex call per word.
export function tokenize(text: string): string[] {
  const words = text.toLowerCase().replace(ELISION, "");
  const tokens: string[] = [];
  let start = 0;
  let i = 0;
  while (i <= words.length) {
    const code = words.codePointAt(i) ?? 0;
    const end = i + (code > 0xffff ? 2 : 1);
    if (i === words.length || !isWordCharacter(code)) {
      const token = tokenOf(words.slice(start, i));
      if (token !== "") tokens.push(token);
      start = end;
    }
    i = end;
  }
  return tokens;
}
