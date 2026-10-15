import stem from "wink-porter2-stemmer";
import { STOPWORDS } from "./stopwords.js";

const ELISION =
  /(?<=[\p{L}\p{N}])(?:n['’]t|['’](?:s|re|ll|ve|d|m))(?![\p{L}\p{N}])/gu;
const SEPARATOR = /[^\p{L}\p{N}]+/u;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(ELISION, "")
    .split(SEPARATOR)
    .filter((word) => word !== "" && !STOPWORDS.has(word))
    .map(stem)
    .filter((token) => token !== "");
}
