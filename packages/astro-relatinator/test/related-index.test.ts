import { describe, expect, it } from "vitest";
import { relatedIndex } from "../src/related-index.js";

const corpus = (key: string, entries: { id: string; data: object }[]) => ({
  key,
  entries,
  textOf: (entry: { data: object }) => Object.values(entry.data).join(" "),
  versionOf: (entry: { id: string }) => entry.id,
});

const pets = (third: string) => [
  { id: "a", data: { text: "cats purr" } },
  { id: "b", data: { text: "dogs bark" } },
  { id: "c", data: { text: third } },
];

describe("relatedIndex", () => {
  it("maps ranked ids back to the entries of the corpus", () => {
    const entries = pets("cats nap");
    const index = relatedIndex(corpus("maps", entries), {});

    expect(index.entries(index.model.findRelated("a"))).toEqual([entries[2]]);
    expect(index.entries(["b", "a"])[0]).toBe(entries[1]);
  });

  it("reuses the model while every entry version is unchanged", () => {
    const first = relatedIndex(corpus("reused", pets("cats nap")), {});
    const second = relatedIndex(corpus("reused", pets("dogs nap")), {});

    expect(second.model).toBe(first.model);
    expect(second.model.findRelated("a")).toEqual(["c"]);
  });

  it("rebuilds the model when an entry version changes", () => {
    const entries = pets("dogs nap");
    relatedIndex(corpus("rebuilt", pets("cats nap")), {});
    const rebuilt = relatedIndex(
      { ...corpus("rebuilt", entries), versionOf: (e) => `${e.id}2` },
      {}
    );

    expect(rebuilt.model.findRelated("a")).toEqual([]);
    expect(rebuilt.model.findRelated("b")).toEqual(["c"]);
  });

  it("keeps a model per key and option set", () => {
    const bm25 = relatedIndex(corpus("options", pets("cats nap")), {});
    const tfidf = relatedIndex(corpus("options", pets("cats nap")), {
      method: "tfidf",
    });
    const other = relatedIndex(corpus("other-key", pets("cats nap")), {});

    expect(tfidf.model).not.toBe(bm25.model);
    expect(other.model).not.toBe(bm25.model);
    expect(relatedIndex(corpus("options", pets("cats nap")), {}).model).toBe(
      bm25.model
    );
  });

  it("throws for an id that is not in the corpus", () => {
    const index = relatedIndex(corpus("invariant", pets("cats nap")), {});

    expect(() => index.entries(["a", "missing"])).toThrow(
      'astro-relatinator: internal error: ranked id "missing" is not in the corpus'
    );
  });
});
