import { describe, expect, it } from "vitest";
import {
  suggestTerms,
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

describe("suggestTerms", () => {
  it("suggests the matching terms of each taxonomy", () => {
    expect(suggestTerms(taxonomies, text)).toEqual([
      { taxonomy: "topics", termId: "t-space", label: "Space", score: 1 },
      { taxonomy: "category", termId: "c-science", label: "Science", score: 1 },
    ]);
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
      { taxonomy: "topics", termId: "t-baking", label: "Baking", score: 1 },
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
      { taxonomy: "topics", termId: "t-deep", label: "Space", score: 1 },
      { taxonomy: "topics", termId: "t-outer", label: "Space", score: 1 },
      { taxonomy: "category", termId: "c-space", label: "Space", score: 1 },
    ]);
  });
});
