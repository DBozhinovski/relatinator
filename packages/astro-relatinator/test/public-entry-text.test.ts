import { describe, expect, expectTypeOf, it } from "vitest";
import { emdashEntryText, getEmDashRelated } from "../src/emdash.js";
import { entryText, getRelated } from "../src/index.js";
import { setCollection } from "./astro-content.js";
import { setEmDashCollection } from "./emdash.js";

const ids = (entries: readonly { id: string }[]) => entries.map((e) => e.id);

setCollection("notes", [
  {
    id: "comets",
    data: { title: "Comets", tags: ["space"], draft: false },
    body: "Comets have icy tails.",
  },
  {
    id: "asteroids",
    data: { title: "Asteroids and comets", tags: ["rocks"] },
    body: "Asteroids are rocky.",
  },
  {
    id: "nebula",
    data: { title: "Nebula", tags: ["space"] },
    body: "Clouds of gas and dust.",
  },
  {
    id: "bread",
    data: { title: "Bread", tags: ["baking"] },
    body: "Yeast makes bread rise.",
  },
]);

describe("entryText from astro-relatinator", () => {
  it("gives the text that getRelated reads by default", async () => {
    const text = (entry: Parameters<typeof entryText>[0]) => entryText(entry);

    expect(ids(await getRelated("notes", "comets"))).toEqual([
      "asteroids",
      "nebula",
    ]);
    expect(ids(await getRelated("notes", "comets", { text }))).toEqual([
      "asteroids",
      "nebula",
    ]);
  });

  it("gives the text that getRelated reads with `fields`", async () => {
    const text = (entry: Parameters<typeof entryText>[0]) =>
      entryText(entry, ["title"]);

    expect(
      ids(await getRelated("notes", "comets", { fields: ["title"] }))
    ).toEqual(["asteroids"]);
    expect(ids(await getRelated("notes", "comets", { text }))).toEqual([
      "asteroids",
    ]);
  });

  it("gives the data values and the body of an entry", () => {
    const entry = {
      id: "comets",
      data: { title: "Comets", tags: ["space", "ice"], draft: false },
      body: "Comets have icy tails.",
    };

    expect(entryText(entry)).toBe("Comets space ice Comets have icy tails.");
    expect(entryText(entry, ["title"])).toBe("Comets Comets have icy tails.");
  });
});

const block = (text: string) => ({
  _type: "block",
  _key: "k",
  style: "normal",
  markDefs: [],
  children: [{ _type: "span", _key: "s", text, marks: [] }],
});

const term = (id: string, slug: string, label: string) => ({
  id,
  name: "tag",
  slug,
  label,
});

setEmDashCollection("emdash-notes", [
  {
    id: "comets",
    data: {
      slug: "comets",
      title: "Comets",
      content: [block("Comets have icy tails.")],
      terms: { tag: [term("01T1", "sky", "Space")] },
    },
  },
  {
    id: "asteroids",
    data: {
      slug: "asteroids",
      title: "Asteroids and comets",
      content: [block("Asteroids are rocky.")],
      terms: { tag: [term("01T2", "rock", "Rocks")] },
    },
  },
  {
    id: "nebula",
    data: {
      slug: "nebula",
      title: "Nebula",
      content: [block("Clouds of gas and dust.")],
      terms: { tag: [term("01T1", "sky", "Space")] },
    },
  },
  {
    id: "bread",
    data: {
      slug: "bread",
      title: "Bread",
      content: [block("Yeast makes bread rise.")],
      terms: { tag: [term("01T3", "baking", "Baking")] },
    },
  },
]);

describe("emdashEntryText from astro-relatinator/emdash", () => {
  it("gives the text that getEmDashRelated reads by default", async () => {
    const text = (entry: Parameters<typeof emdashEntryText>[0]) =>
      emdashEntryText(entry);

    expect(ids(await getEmDashRelated("emdash-notes", "comets"))).toEqual([
      "asteroids",
      "nebula",
    ]);
    expect(
      ids(await getEmDashRelated("emdash-notes", "comets", { text }))
    ).toEqual(["asteroids", "nebula"]);
  });

  it("gives the text that getEmDashRelated reads with `fields`", async () => {
    const text = (entry: Parameters<typeof emdashEntryText>[0]) =>
      emdashEntryText(entry, ["title"]);

    expect(
      ids(
        await getEmDashRelated("emdash-notes", "comets", { fields: ["title"] })
      )
    ).toEqual(["asteroids"]);
    expect(
      ids(await getEmDashRelated("emdash-notes", "comets", { text }))
    ).toEqual(["asteroids"]);
  });

  it("gives the content fields as plain text and the labels of the terms", () => {
    const entry = {
      id: "comets",
      data: {
        slug: "comets",
        title: "Comets",
        content: [block("Comets have icy tails.")],
        terms: { tag: [term("01T1", "sky", "Space")] },
      },
    };

    expect(emdashEntryText(entry)).toBe("Comets Comets have icy tails. Space");
    expect(emdashEntryText(entry, ["slug", "content"])).toBe(
      "comets Comets have icy tails."
    );
  });
});

describe("entry text types", () => {
  it("accepts an Astro 7 entry, whose digest can be a number", () => {
    // Astro 7.3.8 types `digest` as `string | number`.
    const digest: string | number = 7;
    const entry = {
      id: "a",
      data: { title: "Comets" },
      body: "Icy tails.",
      digest,
    };

    expect(entryText(entry)).toBe("Comets Icy tails.");
  });

  it("takes an entry and an optional field list, and nothing more", () => {
    expectTypeOf<Parameters<typeof entryText>["length"]>().toEqualTypeOf<
      1 | 2
    >();
    expectTypeOf<Parameters<typeof emdashEntryText>["length"]>().toEqualTypeOf<
      1 | 2
    >();
    expectTypeOf<Parameters<typeof entryText>[1]>().toEqualTypeOf<
      readonly string[] | undefined
    >();
  });
});
