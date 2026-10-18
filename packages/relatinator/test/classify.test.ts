import { describe, expect, it } from "vitest";
import { classify } from "../src/index.js";

const topics = [
  { tag: "community", description: "meetups, conferences, running events" },
  { tag: "performance", description: "speed, profiling, benchmarks" },
  { tag: "offline-first", description: "service workers, sync, caching" },
  { tag: "astro" },
];

describe("classify", () => {
  it("picks the topic whose description has a word of the text", () => {
    expect(classify(topics, "Notes from three meetups this spring")).toEqual([
      { tag: "community", score: 1 },
    ]);
  });

  it("matches a topic through the words of its tag", () => {
    expect(classify(topics, "Building an Astro site")).toEqual([
      { tag: "astro", score: 1 },
    ]);
    expect(classify(topics, "Going offline with a PWA")).toEqual([
      { tag: "offline-first", score: 1 },
    ]);
  });

  it("finds more topics with descriptions than with tags only", () => {
    const tagsOnly = topics.map(({ tag }) => ({ tag }));
    expect(classify(tagsOnly, "Astro meetups")).toEqual([
      { tag: "astro", score: 1 },
    ]);
    const [astro, community, ...rest] = classify(topics, "Astro meetups");
    expect(astro).toEqual({ tag: "astro", score: 1 });
    expect(community.tag).toBe("community");
    expect(community.score).toBeCloseTo(0.628866, 6);
    expect(rest).toEqual([]);
  });

  it("returns [] only when the text has no topic word", () => {
    expect(classify(topics, "meetups")).toEqual([
      { tag: "community", score: 1 },
    ]);
    expect(classify(topics, "Rust on embedded boards")).toEqual([]);
    expect(classify(topics, "")).toEqual([]);
    expect(classify([], "meetups")).toEqual([]);
  });

  it("leaves out topics without a word of the text, even at ratio 0", () => {
    expect(classify(topics, "meetups", { ratio: 0 })).toEqual([
      { tag: "community", score: 1 },
    ]);
  });
});

describe("classify validation", () => {
  it("throws an error that names a duplicate tag", () => {
    const duplicates = [{ tag: "news" }, { tag: "news", description: "press" }];
    expect(() => classify(duplicates, "news")).toThrow(
      'Duplicate topic tag: "news"'
    );
  });

  it.each([-0.1, 1.5, Number.NaN])("rejects the ratio %d", (ratio) => {
    const run = () => classify(topics, "meetups", { ratio });
    expect(run).toThrow(RangeError);
    expect(run).toThrow(`Invalid ratio: ${ratio}. Use a number from 0 to 1.`);
  });

  it.each([null, "0.7"])(
    "rejects the ratio %j, which is not a number",
    (ratio) => {
      const run = () =>
        classify(topics, "meetups", { ratio: ratio as unknown as number });
      expect(run).toThrow(RangeError);
    }
  );
});

// Every topic has "css" once, so shorter topics score higher.
const styles = [
  { tag: "css" },
  { tag: "layout", description: "css grid" },
  { tag: "design", description: "css colors typography spacing" },
  {
    tag: "animation",
    description:
      "css transitions keyframes easing timing springs gestures scroll parallax sprites",
  },
];

describe("classify scores", () => {
  it("scores each topic relative to the best one, and cuts at half of it", () => {
    const [css, layout, design, ...rest] = classify(styles, "css");
    expect(css).toEqual({ tag: "css", score: 1 });
    expect(layout.tag).toBe("layout");
    expect(layout.score).toBeCloseTo(0.8043478, 6);
    expect(design.tag).toBe("design");
    expect(design.score).toBeCloseTo(0.6727273, 6);
    expect(rest).toEqual([]);
  });

  it("keeps the topics that score at least ratio", () => {
    const tags = (ratio: number) =>
      classify(styles, "css", { ratio }).map(({ tag }) => tag);
    expect(tags(0.7)).toEqual(["css", "layout"]);
    expect(tags(1)).toEqual(["css"]);
  });

  it("returns at most limit topics, 3 by default", () => {
    const tags = (limit?: number) =>
      classify(styles, "css", { ratio: 0, limit }).map(({ tag }) => tag);
    expect(tags()).toEqual(["css", "layout", "design"]);
    expect(tags(2)).toEqual(["css", "layout"]);
    expect(tags(10)).toEqual(["css", "layout", "design", "animation"]);
    expect(tags(0)).toEqual([]);
  });

  it.each([
    [-1, ["css", "layout", "design"]],
    [Number.NaN, []],
    [2.5, ["css", "layout"]],
    [Infinity, ["css", "layout", "design", "animation"]],
  ])("reads the limit %d as findRelatedToText does", (limit, expected) => {
    const tags = classify(styles, "css", { ratio: 0, limit }).map(
      ({ tag }) => tag
    );
    expect(tags).toEqual(expected);
  });

  it("orders tied topics by their input order", () => {
    const react = { tag: "react", description: "hooks" };
    const vue = { tag: "vue", description: "hooks" };
    expect(classify([react, vue], "hooks")).toEqual([
      { tag: "react", score: 1 },
      { tag: "vue", score: 1 },
    ]);
    expect(classify([vue, react], "hooks")).toEqual([
      { tag: "vue", score: 1 },
      { tag: "react", score: 1 },
    ]);
  });
});
