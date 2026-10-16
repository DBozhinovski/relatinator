import { describe, expect, it } from "vitest";
import { createModel } from "../src/index.js";
import type { SimilarityMethod } from "../src/index.js";

const languages = [
  { id: "node", content: "this document is about node." },
  { id: "ruby", content: "this document is about ruby." },
  { id: "ruby-node", content: "this document is about ruby and node." },
  {
    id: "node-examples",
    content: "this document is about node. it has node examples",
  },
];

describe("createModel with tfidf", () => {
  const model = createModel(languages, { method: "tfidf" });

  it("ranks documents by summed tf-idf of the query terms", () => {
    expect(model.findRelatedToText("node")).toEqual([
      "node-examples",
      "node",
      "ruby-node",
    ]);
    expect(model.findRelated("node")).toEqual([
      "node-examples",
      "ruby-node",
      "ruby",
    ]);
  });

  it("breaks score ties by corpus insertion order", () => {
    expect(model.findRelated("ruby")).toEqual([
      "ruby-node",
      "node",
      "node-examples",
    ]);
  });
});

describe("createModel with bm25", () => {
  const model = createModel(languages);

  it("uses bm25 by default", () => {
    expect(model.method).toBe("bm25");
  });

  it("ranks documents by summed bm25 weight of the query terms", () => {
    expect(model.findRelated("node")).toEqual([
      "node-examples",
      "ruby-node",
      "ruby",
    ]);
    expect(model.findRelated("ruby")).toEqual([
      "ruby-node",
      "node",
      "node-examples",
    ]);
  });
});

const fruit = [
  { id: "a", content: "apple apple banana" },
  { id: "b", content: "banana cherry" },
  { id: "c", content: "cherry" },
];

describe("hand-computed term weights", () => {
  it("tfidf weight is tf * (1 + ln(N / (1 + df)))", () => {
    const [appl, banana] = createModel(fruit, { method: "tfidf" }).getTopTerms(
      "a"
    );
    expect(appl.term).toBe("appl");
    expect(appl.score).toBeCloseTo(2.8109302, 6);
    expect(banana).toEqual({ term: "banana", score: 1 });
  });

  it("bm25 weight uses k1 = 1.2 and b = 0.75 by default", () => {
    const model = createModel(fruit);
    const [appl, banana] = model.getTopTerms("a");
    expect(appl.term).toBe("appl");
    expect(appl.score).toBeCloseTo(1.1823695, 6);
    expect(banana.term).toBe("banana");
    expect(banana.score).toBeCloseTo(0.3901917, 6);
    expect(model.getTopTerms("c")[0].score).toBeCloseTo(0.5908617, 6);
  });

  it("bm25 weight honors custom k1 and b", () => {
    const [cherri] = createModel(fruit, { bm25: { k1: 2, b: 1 } }).getTopTerms(
      "c"
    );
    expect(cherri.score).toBeCloseTo(0.7050054, 6);
  });
});

describe.each(["tfidf", "bm25"] as const)("queries with %s", (method) => {
  const model = createModel(languages, { method });

  it("reports corpus size and membership", () => {
    expect(model.size).toBe(4);
    expect(model.has("ruby")).toBe(true);
    expect(model.has("python")).toBe(false);
  });

  it("never returns the queried document from findRelated", () => {
    expect(model.findRelated("node-examples", { limit: 10 })).toEqual([
      "node",
      "ruby-node",
      "ruby",
    ]);
  });

  it("applies the limit", () => {
    expect(model.findRelated("node", { limit: 1 })).toEqual(["node-examples"]);
    expect(model.findRelatedToText("document", { limit: 2 })).toEqual([
      "node",
      "ruby",
    ]);
  });

  it("drops ids listed in exclude", () => {
    expect(model.findRelatedToText("node")).toEqual([
      "node-examples",
      "node",
      "ruby-node",
    ]);
    expect(
      model.findRelatedToText("node", { exclude: ["node-examples"] })
    ).toEqual(["node", "ruby-node"]);
  });

  it("leaves out documents that share no terms with the query", () => {
    expect(model.findRelatedToText("examples")).toEqual(["node-examples"]);
    expect(model.findRelatedToText("python")).toEqual([]);
  });

  it("throws an error that names an unknown id", () => {
    expect(() => model.findRelated("python")).toThrow(
      'Unknown document id: "python"'
    );
    expect(() => model.getTopTerms("python")).toThrow(
      'Unknown document id: "python"'
    );
  });

  it("finds the documents that weigh a term highest", () => {
    expect(model.getTopDocumentsForTerm("Examples!")).toEqual([
      "node-examples",
    ]);
    expect(model.getTopDocumentsForTerm("the")).toEqual([]);
  });
});

describe("top terms and term lookups", () => {
  it("orders tied term weights by term", () => {
    expect(createModel(fruit, { method: "tfidf" }).getTopTerms("b")).toEqual([
      { term: "banana", score: 1 },
      { term: "cherri", score: 1 },
    ]);
  });

  it("returns at most limit terms, highest first", () => {
    const terms = createModel(languages, { method: "tfidf" }).getTopTerms(
      "node-examples",
      2
    );
    expect(terms.map(({ term }) => term)).toEqual(["node", "exampl"]);
  });

  it("ranks documents for a term by its weight, ties in insertion order", () => {
    expect(createModel(fruit).getTopDocumentsForTerm("cherries")).toEqual([
      "c",
      "b",
    ]);
    expect(
      createModel(fruit, { method: "tfidf" }).getTopDocumentsForTerm("cherries")
    ).toEqual(["b", "c"]);
  });
});

describe("corpus validation", () => {
  it("throws an error that names a duplicate id", () => {
    expect(() =>
      createModel([
        { id: "x", content: "one" },
        { id: "x", content: "two" },
      ])
    ).toThrow('Duplicate document id: "x"');
  });

  it("answers every query on an empty corpus with no results", () => {
    const model = createModel([]);
    expect(model.size).toBe(0);
    expect(model.findRelatedToText("anything")).toEqual([]);
    expect(model.getTopDocumentsForTerm("anything")).toEqual([]);
  });

  const invalidMethods = [
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toLocaleString",
    "__lookupGetter__",
    "__lookupSetter__",
    "__defineGetter__",
    "__defineSetter__",
    "__proto__",
    "foo",
  ];
  const corpora = {
    "with terms": languages,
    "without terms": [
      { id: "a", content: "" },
      { id: "b", content: "the and of" },
    ],
  };

  describe.each(Object.entries(corpora))("on a corpus %s", (_, docs) => {
    it.each(invalidMethods)("rejects the method %j", (method) => {
      const options = { method: method as SimilarityMethod };
      let thrown: unknown;
      try {
        createModel(docs, options);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(TypeError);
      expect((thrown as TypeError).message).toBe(
        "weightings[method] is not a function"
      );
    });
  });
});
