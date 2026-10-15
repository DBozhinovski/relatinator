import { describe, expect, it } from "vitest";
import { createModel } from "relatinator";
import { getCachedModel } from "../src/model-cache.js";

const docs = [
  { id: "a", content: "apples and pears" },
  { id: "b", content: "apples and plums" },
];

describe("getCachedModel", () => {
  it("builds once per key while the fingerprint stays the same", () => {
    let builds = 0;
    const build = () => {
      builds += 1;
      return createModel(docs);
    };

    const first = getCachedModel("same", "v1", build);
    const second = getCachedModel("same", "v1", build);

    expect(builds).toBe(1);
    expect(second).toBe(first);
    expect(first.findRelated("a")).toEqual(["b"]);
  });

  it("rebuilds and replaces the entry when the fingerprint changes", () => {
    const v1 = getCachedModel("changing", "v1", () => createModel(docs));
    const v2 = getCachedModel("changing", "v2", () =>
      createModel([...docs, { id: "c", content: "pears only" }])
    );
    const v2Again = getCachedModel("changing", "v2", () => createModel([]));

    expect(v2).not.toBe(v1);
    expect(v2Again).toBe(v2);
    expect(v2Again.findRelated("c")).toEqual(["a"]);
  });

  it("keeps models for different keys apart", () => {
    const left = getCachedModel("left", "v1", () => createModel(docs));
    const right = getCachedModel("right", "v1", () =>
      createModel([{ id: "z", content: "zebra" }])
    );

    expect(left.has("a")).toBe(true);
    expect(right.has("a")).toBe(false);
    expect(right.has("z")).toBe(true);
  });
});
