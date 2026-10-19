import { tokenize } from "relatinator";
import { describe, expect, it } from "vitest";
import {
  suggestTerms,
  topicModel,
  topicText,
  type TaxonomyTerms,
} from "../src/emdash-topics.js";

const taxonomies: TaxonomyTerms[] = [
  {
    name: "topics",
    label: "Topics",
    terms: [
      {
        id: "t-space",
        slug: "space",
        label: "Space",
        data: { description: "black holes, galaxies, the event horizon" },
      },
      {
        id: "t-baking",
        slug: "baking",
        label: "Baking",
        data: { description: "sourdough bread, flour, ovens" },
      },
    ],
  },
  {
    name: "category",
    label: "Categories",
    terms: [
      {
        id: "c-science",
        slug: "science",
        label: "Science",
        data: { description: "physics of stars and black holes" },
      },
      { id: "c-food", slug: "food", label: "Food", data: null },
    ],
  },
];

const text = "Black holes bend light near the event horizon.";

const triage: TaxonomyTerms[] = [
  {
    name: "status",
    label: "Status",
    terms: [
      {
        id: "s-triage",
        slug: "triage",
        label: "Triage",
        data: { description: "bugs we won't fix" },
      },
    ],
  },
];

describe("suggestTerms", () => {
  it("suggests the matching terms of each taxonomy", () => {
    expect(suggestTerms(taxonomies, text)).toEqual([
      {
        taxonomy: "topics",
        termId: "t-space",
        label: "Space",
        score: 1,
        matchedWords: ["black", "event", "holes"],
      },
      {
        taxonomy: "category",
        termId: "c-science",
        label: "Science",
        score: 1,
        matchedWords: ["black", "holes"],
      },
    ]);
  });

  it("gives the words of the text that matched each term, best first", () => {
    const text = "Black holes bend light. Holes near the event horizon.";

    expect(
      suggestTerms(taxonomies, text).map(({ termId, matchedWords }) => ({
        termId,
        matchedWords,
      }))
    ).toEqual([
      { termId: "t-space", matchedWords: ["holes", "black", "event"] },
      { termId: "c-science", matchedWords: ["holes", "black"] },
    ]);
  });

  it("shows each matched word without an elided ending", () => {
    const [suggestion] = suggestTerms(taxonomies, "The galaxy's black holes");

    expect(suggestion.matchedWords).toEqual(["black", "galaxy", "holes"]);
  });

  it("shows the word of the text for a stem that tokenize() takes from an elision", () => {
    const [suggestion] = suggestTerms(triage, "We won't fix it.");

    expect(suggestion.matchedWords).toEqual(["fix", "won't"]);
  });

  it("shows one word of a hyphenated piece, without its stopwords", () => {
    const [suggestion] = suggestTerms(triage, "This isn't-a-bug report.");

    expect(suggestion.matchedWords).toEqual(["bug"]);
  });

  it("weighs the terms with the topic documents of classify()", () => {
    const text =
      "Black holes near the event horizon. Stars bake bread, and food.";
    const counts = new Map<string, number>();
    for (const token of tokenize(text)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    const suggestions = suggestTerms(taxonomies, text, { ratio: 0 });

    expect(suggestions).toHaveLength(4);
    for (const { name, terms } of taxonomies) {
      const model = topicModel(terms);
      const totals = new Map(
        terms.map(({ id, slug }) => [
          id,
          model
            .getTopTerms(slug, Infinity)
            .reduce(
              (sum, { term, score }) => sum + score * (counts.get(term) ?? 0),
              0
            ),
        ])
      );
      const best = Math.max(...totals.values());
      for (const { termId, score } of suggestions.filter(
        ({ taxonomy }) => taxonomy === name
      )) {
        expect((totals.get(termId) ?? 0) / best).toBeCloseTo(score, 12);
      }
    }
  });

  it("does not let the labels of the entry's own terms raise scores", () => {
    const entry = {
      id: "bread",
      data: {
        title: "Bread",
        body: "Sourdough bread needs flour.",
        terms: {
          category: [{ id: "c-science", label: "Science black holes" }],
        },
      },
    };

    expect(suggestTerms(taxonomies, topicText(entry))).toEqual([
      {
        taxonomy: "topics",
        termId: "t-baking",
        label: "Baking",
        score: 1,
        matchedWords: ["bread", "flour", "sourdough"],
      },
    ]);
  });

  it("accepts the same label in several taxonomies and in one taxonomy", () => {
    const sameLabels: TaxonomyTerms[] = [
      {
        name: "topics",
        label: "Topics",
        terms: [
          { id: "t-deep", slug: "deep", label: "Space" },
          { id: "t-outer", slug: "outer", label: "Space" },
        ],
      },
      {
        name: "category",
        label: "Categories",
        terms: [{ id: "c-space", slug: "space", label: "Space" }],
      },
    ];

    expect(suggestTerms(sameLabels, "Space")).toEqual([
      {
        taxonomy: "topics",
        termId: "t-deep",
        label: "Space",
        score: 1,
        matchedWords: ["space"],
      },
      {
        taxonomy: "topics",
        termId: "t-outer",
        label: "Space",
        score: 1,
        matchedWords: ["space"],
      },
      {
        taxonomy: "category",
        termId: "c-space",
        label: "Space",
        score: 1,
        matchedWords: ["space"],
      },
    ]);
  });
});
