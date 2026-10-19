import { describe, expect, it } from "vitest";
import { getRelated } from "../src/index.js";
import { setCollection } from "./astro-content.js";

const ids = (entries: readonly { id: string }[]) => entries.map((e) => e.id);

const posts = setCollection("posts", [
  {
    id: "black-holes",
    data: { title: "Black holes", tags: ["space"] },
    body: "Black holes bend light near the event horizon.",
    digest: "1",
  },
  {
    id: "event-horizon",
    data: { title: "The event horizon", tags: ["space"] },
    body: "Nothing escapes black holes past the event horizon.",
    digest: "1",
  },
  {
    id: "galaxies",
    data: { title: "Galaxies", tags: ["space"] },
    body: "Spiral galaxies hold billions of stars.",
    digest: "1",
  },
  {
    id: "sourdough",
    data: { title: "Sourdough", tags: ["baking"] },
    body: "Flour, water and salt make bread.",
    digest: "1",
  },
]);

describe("getRelated", () => {
  it("returns the collection's related entries in rank order", async () => {
    const related = await getRelated("posts", posts[0]);

    expect(ids(related)).toEqual(["event-horizon", "galaxies"]);
    expect(related[0]).toBe(posts[1]);
  });

  it("accepts an entry id instead of an entry", async () => {
    expect(ids(await getRelated("posts", "black-holes"))).toEqual([
      "event-horizon",
      "galaxies",
    ]);
  });

  it("returns at most `limit` entries", async () => {
    expect(ids(await getRelated("posts", "black-holes", { limit: 1 }))).toEqual(
      ["event-horizon"]
    );
  });

  it("applies `filter` to the entries before the limit", async () => {
    const related = await getRelated("posts", "black-holes", {
      limit: 1,
      filter: (entry) => entry.data.title !== "The event horizon",
    });

    expect(ids(related)).toEqual(["galaxies"]);
    expect(related[0]).toBe(posts[2]);
  });

  it("throws for an id that is not in the collection", async () => {
    await expect(getRelated("posts", "missing")).rejects.toThrow(
      'astro-relatinator: no entry "missing" in collection "posts"'
    );
  });

  it("reads only the listed data fields when `fields` is set", async () => {
    setCollection("recipes", [
      { id: "bread", data: { title: "Bread", note: "zebra" }, body: "flour" },
      { id: "cake", data: { title: "Cake", note: "zebra" }, body: "sugar" },
      { id: "pizza", data: { title: "Pizza bread" }, body: "cheese" },
    ]);

    expect(ids(await getRelated("recipes", "bread"))).toEqual([
      "cake",
      "pizza",
    ]);
    expect(
      ids(await getRelated("recipes", "bread", { fields: ["title"] }))
    ).toEqual(["pizza"]);
  });

  it("uses the `text` option instead of the default text", async () => {
    const related = await getRelated("posts", "sourdough", {
      text: (entry) => (entry.id === "galaxies" ? "bread flour" : entry.body),
    });

    expect(ids(related)).toEqual(["galaxies"]);
    expect(ids(await getRelated("posts", "sourdough"))).toEqual([]);
  });

  it("tells apart `text` closures that share their source code", async () => {
    const textFrom =
      (key: "title" | "body") => (entry: (typeof posts)[number]) =>
        String(key === "body" ? entry.body : entry.data.title);

    expect(
      ids(await getRelated("posts", "black-holes", { text: textFrom("title") }))
    ).toEqual([]);
    expect(
      ids(await getRelated("posts", "black-holes", { text: textFrom("body") }))
    ).toEqual(["event-horizon"]);
  });
});

describe("getRelated method", () => {
  const filler =
    "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu";
  setCollection("fruit", [
    { id: "query", data: {}, body: "apple" },
    {
      id: "long",
      data: {},
      body: `apple apple apple apple apple apple ${filler}`,
    },
    { id: "short", data: {}, body: "apple" },
  ]);

  it("ranks with bm25 by default, which damps long documents", async () => {
    expect(ids(await getRelated("fruit", "query"))).toEqual(["short", "long"]);
  });

  it("ranks with raw term frequency when method is tfidf", async () => {
    expect(
      ids(await getRelated("fruit", "query", { method: "tfidf" }))
    ).toEqual(["long", "short"]);
  });
});

describe("getRelated cache", () => {
  const notes = (digest: string | undefined, body: string) => [
    { id: "a", data: {}, body: "cats purr", digest: "a" },
    { id: "b", data: {}, body: "dogs bark", digest: "b" },
    { id: "c", data: {}, body, digest },
  ];

  it("reuses the model while every digest is unchanged", async () => {
    setCollection("cached", notes("c1", "cats nap"));
    expect(ids(await getRelated("cached", "a"))).toEqual(["c"]);

    setCollection("cached", notes("c1", "dogs nap"));
    expect(ids(await getRelated("cached", "a"))).toEqual(["c"]);
  });

  it("rebuilds the model when a digest changes", async () => {
    setCollection("rebuilt", notes("c1", "cats nap"));
    expect(ids(await getRelated("rebuilt", "a"))).toEqual(["c"]);

    setCollection("rebuilt", notes("c2", "dogs nap"));
    expect(ids(await getRelated("rebuilt", "a"))).toEqual([]);
    expect(ids(await getRelated("rebuilt", "b"))).toEqual(["c"]);
  });

  it("compares text when entries have no digest", async () => {
    setCollection("undigested", notes(undefined, "cats nap"));
    expect(ids(await getRelated("undigested", "a"))).toEqual(["c"]);

    setCollection("undigested", notes(undefined, "dogs nap"));
    expect(ids(await getRelated("undigested", "b"))).toEqual(["c"]);
  });
});
