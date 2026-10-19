import { describe, expect, it } from "vitest";
import { generateCorpus } from "../bench/corpus.js";
import { createModel } from "../src/index.js";
import type { QueryOptions, SimilarityMethod } from "../src/index.js";

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

  it("applies filter before the limit, so the limit still fills", () => {
    const notNode = (id: string) => id !== "node";

    expect(
      model.findRelated("node-examples", { limit: 2, filter: notNode })
    ).toEqual(["ruby-node", "ruby"]);
    expect(
      model.findRelatedToText("node", {
        limit: 2,
        filter: (id) => id !== "node-examples",
      })
    ).toEqual(["node", "ruby-node"]);
  });

  it("drops excluded ids from findRelated before the limit", () => {
    expect(
      model.findRelated("node-examples", { limit: 2, exclude: ["node"] })
    ).toEqual(["ruby-node", "ruby"]);
  });

  it("applies filter before a limit above 64, which sorts", () => {
    const ruby = (id: string) => id.startsWith("ruby");

    expect(
      model.findRelated("node-examples", { limit: 100, filter: ruby })
    ).toEqual(["ruby-node", "ruby"]);
    expect(
      model.findRelatedToText("node", { limit: 100, filter: ruby })
    ).toEqual(["ruby-node"]);
  });

  it("gives the same results with no filter and with a filter that keeps all", () => {
    expect(model.findRelated("node-examples", { limit: 2 })).toEqual([
      "node",
      "ruby-node",
    ]);
    expect(
      model.findRelated("node-examples", { limit: 2, filter: () => true })
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

describe("scored related documents", () => {
  it("gives each tfidf result the summed weight of the query terms", () => {
    const model = createModel(languages, { method: "tfidf" });
    // node: 2 · idf 1 = 2. document: idf 1 + ln(4 / 5) = 0.7768564.
    const [first, second, third] = model.findRelatedScored("node-examples");
    expect(first).toEqual({ id: "node", score: expect.any(Number) });
    expect(first.score).toBeCloseTo(2.7768564, 6);
    expect(second.id).toBe("ruby-node");
    expect(second.score).toBeCloseTo(2.7768564, 6);
    expect(third.id).toBe("ruby");
    expect(third.score).toBeCloseTo(0.7768564, 6);
  });

  it("gives each bm25 result the summed weight of the query terms", () => {
    const model = createModel(fruit);
    const [c, a, ...rest] = model.findRelatedScored("b");
    expect(rest).toEqual([]);
    expect(c.id).toBe("c");
    expect(c.score).toBeCloseTo(0.5908617, 6);
    expect(a.id).toBe("a");
    expect(a.score).toBeCloseTo(0.3901917, 6);
  });

  it("scores a text query with tfidf", () => {
    const model = createModel(fruit, { method: "tfidf" });
    // appl: 2 · (1 + ln(3 / 2)) = 2.8109302. banana: idf 1 + ln(3 / 3) = 1.
    const [a, b, ...rest] = model.findRelatedToTextScored("apple banana");
    expect(rest).toEqual([]);
    expect(a.id).toBe("a");
    expect(a.score).toBeCloseTo(3.8109302, 6);
    expect(b).toEqual({ id: "b", score: 1 });
  });

  it("scores a text query with bm25", () => {
    const model = createModel(fruit);
    const [a, b, ...rest] = model.findRelatedToTextScored("apple banana");
    expect(rest).toEqual([]);
    expect(a.id).toBe("a");
    expect(a.score).toBeCloseTo(1.1823695 + 0.3901917, 6);
    expect(b.id).toBe("b");
    expect(b.score).toBeCloseTo(0.4700036, 6);
  });
});

// 120 documents, so the limits above 64, which sort, return more than 64 ids.
const posts = generateCorpus(120, { seed: 21, maxWords: 200 });
const evenPost = (id: string) => /[02468]$/.test(id);
const optionSets: [string, QueryOptions | undefined][] = [
  ["no options", undefined],
  ["limit 0", { limit: 0 }],
  ["limit 1", { limit: 1 }],
  ["limit 64", { limit: 64 }],
  ["limit 65", { limit: 65 }],
  ["limit 200", { limit: 200 }],
  ["limit Infinity", { limit: Infinity }],
  ["exclude", { exclude: ["post-24", "post-55", "post-88"] }],
  ["filter", { filter: evenPost }],
  [
    "limit 100, exclude, filter",
    { limit: 100, exclude: ["post-24"], filter: evenPost },
  ],
];

describe.each(["tfidf", "bm25"] as const)(
  "scored queries agree with the id queries for %s",
  (method) => {
    const model = createModel(posts, { method });

    it.each(optionSets)("findRelatedScored with %s", (_, options) => {
      for (const id of ["post-1", "post-7"]) {
        const scored = model.findRelatedScored(id, options);
        expect(scored.map((doc) => doc.id)).toEqual(
          model.findRelated(id, options)
        );
      }
    });

    it.each(optionSets)("findRelatedToTextScored with %s", (_, options) => {
      for (const { content } of posts.slice(10, 12)) {
        const scored = model.findRelatedToTextScored(content, options);
        expect(scored.map((doc) => doc.id)).toEqual(
          model.findRelatedToText(content, options)
        );
      }
    });

    it("explains each score with contributions that sum to it", () => {
      for (const id of ["post-1", "post-7"]) {
        const related = model.findRelatedScored(id, { limit: Infinity });
        expect(related.length).toBeGreaterThan(64);
        for (const { id: otherId, score } of related) {
          const terms = model.explainRelated(id, otherId, Infinity);
          const sum = terms.reduce((total, term) => total + term.score, 0);
          expect(sum).toBeCloseTo(score, 6);
        }
      }
    });
  }
);

describe("explained relations", () => {
  it("gives the tfidf contribution of each shared term, highest first", () => {
    const model = createModel(languages, { method: "tfidf" });
    // node: query tf 2 · weight 1. document: 1 · (1 + ln(4 / 5)).
    const [node, document, ...rest] = model.explainRelated(
      "node-examples",
      "ruby-node"
    );
    expect(rest).toEqual([]);
    expect(node).toEqual({ term: "node", score: 2 });
    expect(document.term).toBe("document");
    expect(document.score).toBeCloseTo(0.7768564, 6);
    expect(model.explainRelated("node-examples", "ruby-node", 1)).toEqual([
      node,
    ]);
  });

  it("gives the bm25 weight of each shared term in the other document", () => {
    const model = createModel(fruit);
    const [inA, ...restA] = model.explainRelated("b", "a");
    expect(restA).toEqual([]);
    expect(inA.term).toBe("banana");
    expect(inA.score).toBeCloseTo(0.3901917, 6);
    const [inB, ...restB] = model.explainRelated("a", "b");
    expect(restB).toEqual([]);
    expect(inB.term).toBe("banana");
    expect(inB.score).toBeCloseTo(0.4700036, 6);
  });

  it("gives no terms for documents that share no term", () => {
    const model = createModel(fruit);
    expect(model.explainRelated("a", "c")).toEqual([]);
    expect(model.findRelated("a")).toEqual(["b"]);
  });

  it("orders equal contributions by term", () => {
    const model = createModel(
      [
        { id: "x", content: "pear plum" },
        { id: "y", content: "plum pear" },
        { id: "z", content: "kiwi" },
      ],
      { method: "tfidf" }
    );
    expect(model.explainRelated("y", "x")).toEqual([
      { term: "pear", score: 1 },
      { term: "plum", score: 1 },
    ]);
  });

  it("throws an error that names an unknown id", () => {
    const model = createModel(languages);
    expect(() => model.explainRelated("python", "node")).toThrow(
      'Unknown document id: "python"'
    );
    expect(() => model.explainRelated("node", "python")).toThrow(
      'Unknown document id: "python"'
    );
  });
});
