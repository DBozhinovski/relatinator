import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import * as reference from "relatinator-reference";
import { describe, expect, it } from "vitest";
import { generateCorpus } from "../bench/corpus.js";
import * as current from "../src/index.js";
import type {
  ModelOptions,
  RelatinatorDocument,
  RelatinatorModel,
} from "../src/index.js";

// Every public output of the current source must equal the output of the
// published relatinator@3.0.0, including exact scores, tie order, and
// error messages.

type Api = Pick<typeof current, "createModel" | "tokenize">;
type Outcome =
  | { readonly value: unknown }
  | { readonly error: { readonly name: string; readonly message: string } };
type Entry = readonly [call: string, outcome: Outcome];
type Probe = readonly [call: string, run: (model: RelatinatorModel) => unknown];

function outcome(run: () => unknown): Outcome {
  try {
    return { value: run() };
  } catch (error) {
    const { name, message } = error as Error;
    return { error: { name, message } };
  }
}

// Calls the methods without their object, as `const { findRelated } = model`
// does.
function detached(model: RelatinatorModel): RelatinatorModel {
  const { method, size, has, findRelated, findRelatedToText } = model;
  const { getTopTerms, getTopDocumentsForTerm } = model;
  return {
    method,
    size,
    has,
    findRelated,
    findRelatedToText,
    getTopTerms,
    getTopDocumentsForTerm,
  };
}

function record(
  api: Api,
  docs: readonly RelatinatorDocument[],
  options: ModelOptions | undefined,
  probes: readonly Probe[]
): Entry[] {
  const built = outcome(() => api.createModel(docs, options));
  if (!("value" in built)) return [["createModel", built]];
  const model = built.value as RelatinatorModel;
  const shape = { keys: Object.keys(model), method: model.method };
  return [
    ["createModel", { value: { ...shape, size: model.size } }],
    ...probes.map(([call, run]): Entry => [
      call,
      outcome(() => run(detached(model))),
    ]),
  ];
}

function expectSameEntries(
  actual: readonly unknown[],
  expected: readonly unknown[]
) {
  const mismatched = actual.flatMap((entry, i) =>
    isDeepStrictEqual(entry, expected[i]) ? [] : [i]
  );
  const [first] = mismatched;
  const entry = actual[first];
  const call =
    Array.isArray(entry) && typeof entry[0] === "string" ? entry[0] : first;
  expect(
    { mismatches: mismatched.length, first: actual[first] },
    `${mismatched.length} of ${expected.length} differ, first at ${call}`
  ).toStrictEqual({ mismatches: 0, first: expected[first] });
  expect(actual.length).toBe(expected.length);
}

// 64 is the largest limit that keeps a top list. Larger limits sort.
const LIMITS = [0, 1, 5, 50, 63, 64, 65, -0] as const;
const ODD_LIMITS = [-1, 1.5, Infinity, NaN] as const;
const TERM_LIMITS = [undefined, 0, 3, 1000] as const;

const show = (limit: number | undefined) =>
  Object.is(limit, -0) ? "-0" : String(limit);

function documentProbes(id: string): Probe[] {
  return [
    [`has(${id})`, (m) => m.has(id)],
    [`findRelated(${id})`, (m) => m.findRelated(id)],
    ...LIMITS.map((limit): Probe => [
      `findRelated(${id}, ${show(limit)})`,
      (m) => m.findRelated(id, { limit }),
    ]),
    ...TERM_LIMITS.map((limit): Probe => [
      `getTopTerms(${id}, ${limit})`,
      (m) => m.getTopTerms(id, limit),
    ]),
  ];
}

function oddProbes(id: string): Probe[] {
  return [
    ...ODD_LIMITS.map((limit): Probe => [
      `findRelated(${id}, ${limit})`,
      (m) => m.findRelated(id, { limit }),
    ]),
    [
      `findRelated(${id}) after mutating an earlier result`,
      (m) => {
        const first = m.findRelated(id, { limit: 50 });
        first.push("mutated");
        first.reverse();
        return m.findRelated(id, { limit: 50 });
      },
    ],
    [
      `getTopTerms(${id}) after mutating an earlier result`,
      (m) => {
        const first = m.getTopTerms(id, 3);
        for (const term of first) term.score = -1;
        first.push({ term: "mutated", score: 99 });
        return m.getTopTerms(id, 3);
      },
    ],
  ];
}

function queryProbes(text: string, ids: readonly string[]): Probe[] {
  const exclude = [...ids.slice(0, 3), "missing"];
  const label = JSON.stringify(text.slice(0, 40));
  return [
    [`findRelatedToText(${label})`, (m) => m.findRelatedToText(text)],
    ...LIMITS.map((limit): Probe => [
      `findRelatedToText(${label}, ${show(limit)})`,
      (m) => m.findRelatedToText(text, { limit }),
    ]),
    [
      `findRelatedToText(${label}, exclude)`,
      (m) => m.findRelatedToText(text, { exclude }),
    ],
    [
      `findRelatedToText(${label}, 50, exclude)`,
      (m) => m.findRelatedToText(text, { limit: 50, exclude }),
    ],
  ];
}

const TERMS = [
  "node",
  "time",
  "people",
  "connections",
  "the",
  "machine learning",
  "Learning machine",
  "zzqxunknown",
  "café",
  "Zürich",
  "東京",
  "constructor",
  "__proto__",
  "toString",
  "2024",
  "",
  "!!!",
  "don't",
];

function termProbes(): Probe[] {
  return TERMS.flatMap((term) =>
    [undefined, ...LIMITS].map((limit): Probe => [
      `getTopDocumentsForTerm(${JSON.stringify(term)}, ${show(limit)})`,
      (m) => m.getTopDocumentsForTerm(term, limit),
    ])
  );
}

const QUERIES = [
  "",
  "the and of it is",
  "zzqx unknownword nothingmatches",
  "Node.js server performance with React components",
  "café Zürich 東京 straße",
  "constructor __proto__ toString valueOf",
];

function probesFor(docs: readonly RelatinatorDocument[]): Probe[] {
  const ids = docs.map((doc) => doc.id);
  const sample = docs.filter((_, i) => i % 7 === 0);
  return [
    ...ids.flatMap(documentProbes),
    ...sample.flatMap((doc) => oddProbes(doc.id)),
    ...["missing", "", "__proto__", "constructor"].flatMap(documentProbes),
    ...[...QUERIES, ...sample.map((doc) => doc.content)].flatMap((text) =>
      queryProbes(text, ids)
    ),
    ...termProbes(),
  ];
}

type OptionSet = readonly (ModelOptions | undefined)[];

const CORE_OPTIONS: OptionSet = [
  undefined,
  { method: "tfidf" },
  { bm25: { k1: 2, b: 0.3 } },
  { method: "bm25", bm25: { k1: 0.5, b: 1 } },
  // Most weights overflow to Infinity, so many scores tie at Infinity.
  { bm25: { k1: 1e308, b: 0 } },
];
const ALL_OPTIONS: OptionSet = [
  ...CORE_OPTIONS,
  { method: "bm25", bm25: {} },
  { method: "tfidf", bm25: { k1: 2, b: 0.3 } },
];

function readTexts(dir: string): RelatinatorDocument[] {
  return fs
    .readdirSync(dir)
    .sort()
    .map((file) => ({
      id: `${path.basename(dir)}/${file}`,
      content: fs.readFileSync(path.join(dir, file), "utf8"),
    }));
}

const fixtures = readTexts(path.join(import.meta.dirname, "fixtures"));
const playground = readTexts(
  path.join(import.meta.dirname, "../../playground/src/content/posts")
);

const CORPORA: Record<string, readonly RelatinatorDocument[]> = {
  "synthetic-0": generateCorpus(0),
  "synthetic-1": generateCorpus(1, { seed: 11 }),
  "synthetic-2": generateCorpus(2, { seed: 12 }),
  "synthetic-60": generateCorpus(60, { seed: 13 }),
  "synthetic-120": generateCorpus(120, { seed: 14 }),
  fixtures,
  playground,
  "fixtures+playground": [...fixtures, ...playground],
};

// The largest corpus runs only the core options to keep the test fast.
const optionsFor = (name: string) =>
  name === "synthetic-120" ? CORE_OPTIONS : ALL_OPTIONS;

describe.each(Object.entries(CORPORA))("equivalence on %s", (name, docs) => {
  const probes = probesFor(docs);

  it.each(
    optionsFor(name).map((options) => [JSON.stringify(options), options])
  )(
    "matches relatinator@3.0.0 with options %s",
    (_label, options) => {
      expectSameEntries(
        record(current, docs, options, probes),
        record(reference, docs, options, probes)
      );
    },
    60_000
  );
});

describe("equivalence of corpus errors", () => {
  const corpora: Record<string, RelatinatorDocument[]> = {
    "duplicate id": [
      { id: "a", content: "one" },
      { id: "b", content: "two" },
      { id: "a", content: "three" },
    ],
    "duplicate empty id": [
      { id: "", content: "one" },
      { id: "", content: "two" },
    ],
    "duplicate generated id": [
      ...generateCorpus(20, { seed: 15 }),
      { id: "post-0", content: "late" },
    ],
  };

  it.each(Object.entries(corpora))("matches on %s", (_, docs) => {
    const actual = record(current, docs, undefined, []);
    expect(actual).toStrictEqual(record(reference, docs, undefined, []));
    expect(actual[0][1]).toHaveProperty("error.message");
  });

  it("throws the 3.0.0 messages for unknown and duplicate ids", () => {
    const docs = corpora["duplicate id"];
    expect(record(current, docs, undefined, [])).toStrictEqual([
      [
        "createModel",
        { error: { name: "Error", message: 'Duplicate document id: "a"' } },
      ],
    ]);
    const [, findRelated] = record(current, docs.slice(0, 2), undefined, [
      ["findRelated(missing)", (m) => m.findRelated("missing")],
    ]);
    expect(findRelated[1]).toStrictEqual({
      error: { name: "Error", message: 'Unknown document id: "missing"' },
    });
  });
});

describe("equivalence after the input changes", () => {
  it("ignores changes to the documents after createModel", () => {
    const run = (api: Api) => {
      const docs = generateCorpus(40, { seed: 16 }).map((doc) => ({ ...doc }));
      const model = api.createModel(docs);
      docs[1].content = "node node node";
      docs.push({ id: "late", content: "node" });
      return [
        ["size", model.size],
        ["has(late)", model.has("late")],
        [
          "findRelatedToText(node)",
          model.findRelatedToText("node", { limit: 50 }),
        ],
        ["getTopTerms(post-1)", model.getTopTerms("post-1", 1000)],
      ];
    };
    expectSameEntries(run(current), run(reference));
  });
});

describe("structure of the synthetic corpus", () => {
  const docs = CORPORA["synthetic-60"];
  const model = current.createModel(docs);

  it("ties exact duplicates and isolates the isolated document", () => {
    expect(model.findRelated("dup-a", { limit: 2 })).toStrictEqual([
      "post-0",
      "dup-b",
    ]);
    expect(model.findRelated("isolated")).toStrictEqual([]);
    expect(model.findRelated("empty")).toStrictEqual([]);
    expect(model.getTopTerms("stopwords-only")).toStrictEqual([]);
    expect(model.has("__proto__") && model.has("")).toBe(true);
  });
});

const TRICKY = [
  "",
  "   ",
  "Don't stop the Node.js server's logs!",
  "Bob’s cats'll purr, they're fine, I'd go, we've won, I'm here",
  "rock'n'roll o'clock y'all ma'am 'tis '90s James' cats'",
  "isn't can't won't shan't ain't n't 't s'",
  "Café—Zürich 2024 東京 straße STRASSE Fußball",
  "İstanbul ǅemal ﬁle Œuvre Ångström ΣΊΣΥΦΟΣ",
  "naïve résumé coöperate piñata crème brûlée façade",
  "Привет мир Ελλάδα 日本語のテキスト 한국어 العربية עברית",
  "e\u0301 cafe\u0301 vs caf\u00e9",
  "x86-64 C++ C# foo_bar __proto__ constructor hasOwnProperty",
  "https://example.com/path?q=connections&x=1 mail@example.com",
  "1,000 3.14 v2.0 10x 1st 2nd 0.0.1 1e9 -42 ½ ² ٣",
  "🚀 emoji 👩‍💻 zwj\u200bzero\u200cwidth",
  "connections connected connecting generously generalization",
  "running runs ran runner happily happiness argued arguing",
  "It is what it is... and that's all!",
  "a".repeat(500),
  "word ".repeat(300),
  "𝐀𝐁𝐂 𝔞𝔟𝔠 𐐀𐐨 𠀀𠀁",
  "a\ud800b \udc00c \ud800",
  "ΑΣ'Α ΟΔΟΣ'",
  "a\u0000b\u0085c",
];

describe("equivalence of tokenize", () => {
  const label = (text: string) =>
    `tokenize(${JSON.stringify(text.slice(0, 40))})`;
  const texts = [
    ...TRICKY,
    ...Object.values(CORPORA).flatMap((docs) => docs.map((d) => d.content)),
  ];

  it("matches relatinator@3.0.0 on every corpus text and tricky string", () => {
    expectSameEntries(
      texts.map((text) => [label(text), current.tokenize(text)]),
      texts.map((text) => [label(text), reference.tokenize(text)])
    );
  });

  it("matches relatinator@3.0.0 after the stem cache fills and clears", () => {
    // 17,576 stems times 7 endings gives 123,032 different words, more
    // than the 100,000 words that the stem cache holds.
    const letters = "abcdefghijklmnopqrstuvwxyz";
    const stems = [...letters].flatMap((a) =>
      [...letters].flatMap((b) => [...letters].map((c) => `${a}${b}${c}`))
    );
    const endings = ["", "s", "ing", "ed", "ness", "ly", "ation"];
    const texts = endings.map((ending) =>
      stems.map((stem) => `${stem}${ending}`).join(" ")
    );
    // The first text again, after the clear removed its words.
    const run = (api: Api) =>
      [...texts, texts[0]].map((text, i) => [i, api.tokenize(text)]);
    expectSameEntries(run(current), run(reference));
  }, 30_000);

  it("tokenizes the tricky strings as 3.0.0 did", () => {
    expect(current.tokenize(TRICKY[4])).toStrictEqual([
      "rock",
      "n",
      "roll",
      "o",
      "clock",
      "y",
      "ma",
      "tis",
      "90s",
      "jame",
      "cat",
    ]);
  });
});
