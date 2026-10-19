import { classify, type ClassifyOptions, type Topic } from "relatinator";
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

function suggestForTaxonomy(
  { name, terms }: TaxonomyTerms,
  text: string,
  options?: ClassifyOptions
): TermSuggestion[] {
  const bySlug = new Map(terms.map((term) => [term.slug, term]));
  return classify(terms.map(topicOf), text, options).map(({ tag, score }) => {
    const term = bySlug.get(tag);
    if (!term) {
      throw new Error(
        `astro-relatinator: internal error: suggested tag "${tag}" is not a term slug`
      );
    }
    return { taxonomy: name, termId: term.id, label: term.label, score };
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
