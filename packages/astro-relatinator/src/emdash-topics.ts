import {
  classify,
  createModel,
  tokenize,
  type ClassifyOptions,
  type RelatinatorModel,
  type Topic,
} from "relatinator";
import { emdashEntryText } from "./emdash-text.js";
import type { ContentEntry } from "./entry-text.js";

/** The parts of an EmDash taxonomy term that the suggestions read. */
export interface TermInfo {
  readonly id: string;
  readonly slug: string;
  readonly label: string;
  readonly data?: Readonly<Record<string, unknown>> | null;
}

/** A taxonomy with its terms in one locale. */
export interface TaxonomyTerms {
  readonly name: string;
  readonly label: string;
  readonly terms: readonly TermInfo[];
}

export interface TermSuggestion {
  taxonomy: string;
  termId: string;
  label: string;
  score: number;
  /**
   * Up to 3 words of the text that matched the term, best first. Each word
   * is the first form of its stem in the text, in lower case.
   */
  matchedWords: string[];
}

const MATCHED_WORD_LIMIT = 3;

/** The tokens of a text, with their counts and the first word of each. */
interface TextTerms {
  readonly counts: ReadonlyMap<string, number>;
  readonly words: ReadonlyMap<string, string>;
}

// `tokenize()` removes elisions before it splits, so "won't" gives "wo".
// A split at a character other than a letter, a digit, or an apostrophe
// does not change the tokens. A split at an apostrophe can, so a piece is
// split there only when it gives more than one token.
const PIECE_SEPARATOR = /[^\p{L}\p{N}'’]+/u;
const APOSTROPHES = /['’]+/u;
const EDGE_APOSTROPHES = /^['’]+|['’]+$/gu;
const ELISION_ENDING = /['’](?:s|re|ll|ve|d|m)$/u;

/** The word without an ending such as "'s" when it gives the same token. */
function wordOf(piece: string, token: string): string {
  const word = piece.replace(EDGE_APOSTROPHES, "");
  const bare = word.replace(ELISION_ENDING, "");
  return tokenize(bare)[0] === token ? bare : word;
}

function addWords(text: string, words: Map<string, string>): void {
  for (const piece of text.split(PIECE_SEPARATOR)) {
    const parts =
      tokenize(piece).length > 1 ? piece.split(APOSTROPHES) : [piece];
    for (const part of parts) {
      const [token, ...others] = tokenize(part);
      if (token !== undefined && others.length === 0 && !words.has(token)) {
        words.set(token, wordOf(part, token));
      }
    }
  }
}

function textTerms(text: string): TextTerms {
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const words = new Map<string, string>();
  addWords(text.toLowerCase(), words);
  return { counts, words };
}

/**
 * The words of the text that add the most to the score of `tag`. A term
 * adds its count in the text times its weight in the topic document.
 */
function matchedWordsFor(
  model: RelatinatorModel,
  tag: string,
  { counts, words }: TextTerms
): string[] {
  return model
    .getTopTerms(tag, Infinity)
    .map(({ term, score }) => ({
      term,
      score: score * (counts.get(term) ?? 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (a.term < b.term ? -1 : 1))
    .slice(0, MATCHED_WORD_LIMIT)
    .map(({ term }) => words.get(term) ?? term);
}

/** The `data.description` of a term, or `undefined` if it has none. */
export function termDescription({ data }: TermInfo): string | undefined {
  const description = data?.description;
  return typeof description === "string" ? description : undefined;
}

function topicOf(term: TermInfo): Topic {
  const description = termDescription(term);
  return {
    tag: term.slug,
    description:
      description === undefined ? term.label : `${term.label}\n${description}`,
  };
}

/**
 * The model of the topic documents of `classify()` for the terms, so the
 * weights of the terms are the weights that gave the scores.
 */
export function topicModel(terms: readonly TermInfo[]): RelatinatorModel {
  return createModel(
    terms.map(topicOf).map(({ tag, description }) => ({
      id: tag,
      content: `${tag}\n${description}`,
    }))
  );
}

function suggestForTaxonomy(
  { name, terms }: TaxonomyTerms,
  text: string,
  options?: ClassifyOptions
): TermSuggestion[] {
  const bySlug = new Map(terms.map((term) => [term.slug, term]));
  const suggestions = classify(terms.map(topicOf), text, options);
  if (suggestions.length === 0) return [];
  const model = topicModel(terms);
  const allTextTerms = textTerms(text);
  return suggestions.map(({ tag, score }) => {
    const term = bySlug.get(tag);
    if (!term) {
      throw new Error(
        `astro-relatinator: internal error: suggested tag "${tag}" is not a term slug`
      );
    }
    return {
      taxonomy: name,
      termId: term.id,
      label: term.label,
      score,
      matchedWords: matchedWordsFor(model, tag, allTextTerms),
    };
  });
}

/**
 * Suggests terms for a text with `classify()`, one taxonomy at a time.
 * The tag of a term is its slug, and its description is its label and
 * `data.description`. The suggestions keep the `classify()` order in each
 * taxonomy.
 */
export function suggestTerms(
  taxonomies: readonly TaxonomyTerms[],
  text: string,
  options?: ClassifyOptions
): TermSuggestion[] {
  return taxonomies.flatMap((taxonomy) =>
    suggestForTaxonomy(taxonomy, text, options)
  );
}

/**
 * The default EmDash text of an entry without the labels of its terms.
 * Otherwise each assigned term matches its own label and takes the best
 * score from the other terms.
 */
export function topicText(entry: ContentEntry): string {
  const { terms: _terms, ...data } = entry.data as Record<string, unknown>;
  return emdashEntryText({ id: entry.id, data });
}
