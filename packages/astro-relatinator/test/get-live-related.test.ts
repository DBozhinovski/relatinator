import { describe, expect, it } from "vitest";
import { getLiveRelated, getRelated } from "../src/index.js";
import { setCollection, setLiveCollection } from "./astro-content.js";

const ids = (entries: readonly { id: string }[]) => entries.map((e) => e.id);

const products = setLiveCollection("products", [
  {
    id: "telescope",
    data: {
      title: "Telescope",
      text: "A telescope shows the stars and the moon.",
    },
  },
  {
    id: "star-map",
    data: { title: "Star map", text: "A map of the stars for each telescope." },
  },
  {
    id: "moon-lamp",
    data: { title: "Moon lamp", text: "A lamp in the shape of the moon." },
  },
  {
    id: "bread-tin",
    data: { title: "Bread tin", text: "Bake bread with flour and water." },
  },
]);

describe("getLiveRelated", () => {
  it("returns the related entries of the live collection in rank order", async () => {
    const related = await getLiveRelated("products", products[0]);

    expect(ids(related)).toEqual(["star-map", "moon-lamp"]);
    expect(related[0]).toBe(products[1]);
  });

  it("applies `filter` to the live entries before the limit", async () => {
    const related = await getLiveRelated("products", "telescope", {
      limit: 1,
      filter: (entry) => entry.data.title !== "Star map",
    });

    expect(ids(related)).toEqual(["moon-lamp"]);
    expect(related[0]).toBe(products[2]);
  });

  it("reads only the listed data fields when `fields` is set", async () => {
    setLiveCollection("live-recipes", [
      { id: "bread", data: { title: "Bread", note: "zebra" } },
      { id: "cake", data: { title: "Cake", note: "zebra" } },
      { id: "pizza", data: { title: "Pizza bread" } },
    ]);

    expect(ids(await getLiveRelated("live-recipes", "bread"))).toEqual([
      "cake",
      "pizza",
    ]);
    expect(
      ids(await getLiveRelated("live-recipes", "bread", { fields: ["title"] }))
    ).toEqual(["pizza"]);
  });

  it("reads the rendered HTML of an entry as plain text", async () => {
    const page = (id: string, title: string, html: string) => ({
      id,
      data: { title },
      rendered: { html },
    });
    setLiveCollection("live-pages", [
      page("a", "One", "<p>Comets &amp; <strong>icy</strong> tails</p>"),
      page("b", "Two", "<p>Icy comets</p><script>var stars = 1;</script>"),
      page("c", "Three", "<p><strong>Bread</strong> &amp; flour</p>"),
      page("d", "Four", "<style>p { color: stars; }</style><p>Flour</p>"),
    ]);

    expect(ids(await getLiveRelated("live-pages", "a"))).toEqual(["b"]);
    // "stars" is only in the script of b and the style of d.
    expect(ids(await getLiveRelated("live-pages", "b"))).toEqual(["a"]);
    expect(ids(await getLiveRelated("live-pages", "c"))).toEqual(["d"]);
  });

  it("drops named HTML entities that it does not decode", async () => {
    setLiveCollection("live-quotes", [
      { id: "a", data: {}, rendered: { html: "<p>Comets&rsquo; tails</p>" } },
      { id: "b", data: {}, rendered: { html: "<p>Comets</p>" } },
      { id: "c", data: {}, rendered: { html: "<p>Bread&rsquo; crust</p>" } },
    ]);

    expect(ids(await getLiveRelated("live-quotes", "a"))).toEqual(["b"]);
  });

  it("reads the rendered HTML also when `fields` is set", async () => {
    setLiveCollection("live-fields", [
      {
        id: "a",
        data: { title: "One", sku: 1 },
        rendered: { html: "<p>Comets</p>" },
      },
      {
        id: "b",
        data: { title: "Two", sku: 2 },
        rendered: { html: "<p>Comets</p>" },
      },
      {
        id: "c",
        data: { title: "Three", sku: 3 },
        rendered: { html: "<p>Bread</p>" },
      },
    ]);

    expect(
      ids(await getLiveRelated("live-fields", "a", { fields: ["title"] }))
    ).toEqual(["b"]);
  });

  it("throws an error that names the collection when Astro returns an error", async () => {
    const error = new Error("The store API is down.");
    setLiveCollection("offline", error);

    const call = getLiveRelated("offline", "telescope");

    await expect(call).rejects.toThrow(
      'astro-relatinator: cannot read live collection "offline": The store API is down.'
    );
    await expect(call).rejects.toHaveProperty("cause", error);
  });

  it("throws for an id that is not in the live collection", async () => {
    await expect(getLiveRelated("products", "missing")).rejects.toThrow(
      'astro-relatinator: no entry "missing" in live collection "products"'
    );
  });
});

describe("getLiveRelated cache", () => {
  const notes = (c: string) => [
    { id: "a", data: { text: "cats purr" } },
    { id: "b", data: { text: "dogs bark" } },
    { id: "c", data: { text: c } },
  ];

  let reads = 0;
  const text = (entry: { data: Record<string, unknown> }) => {
    reads += 1;
    return String(entry.data.text);
  };
  const related = async (collection: string, id: string) => {
    reads = 0;
    const result = ids(await getLiveRelated(collection, id, { text }));
    return { result, reads };
  };

  it("reuses the model until the text of an entry changes", async () => {
    setLiveCollection("live-notes", notes("cats nap"));
    // A new model reads the text of each entry twice: once for the
    // fingerprint and once for the model.
    expect(await related("live-notes", "a")).toEqual({
      result: ["c"],
      reads: 6,
    });

    setLiveCollection("live-notes", notes("cats nap"));
    expect(await related("live-notes", "a")).toEqual({
      result: ["c"],
      reads: 3,
    });

    setLiveCollection("live-notes", notes("dogs nap"));
    expect(await related("live-notes", "b")).toEqual({
      result: ["c"],
      reads: 6,
    });
  });

  it("rebuilds the model when the default text of an entry changes", async () => {
    setLiveCollection("live-default", notes("cats nap"));
    expect(ids(await getLiveRelated("live-default", "a"))).toEqual(["c"]);

    setLiveCollection("live-default", notes("dogs nap"));
    expect(ids(await getLiveRelated("live-default", "a"))).toEqual([]);
    expect(ids(await getLiveRelated("live-default", "b"))).toEqual(["c"]);
  });

  it("keeps a model apart from the model of getRelated() for the same collection name", async () => {
    // Each digest of the content collection is the text of the live
    // entry with the same id, so both lists give the same fingerprint.
    setCollection("shared", [
      { id: "a", data: {}, body: "cats purr", digest: "moon lamp" },
      { id: "b", data: {}, body: "dogs bark", digest: "moon map" },
      { id: "c", data: {}, body: "cats nap", digest: "bread tin" },
    ]);
    setLiveCollection("shared", [
      { id: "a", data: { text: "moon lamp" } },
      { id: "b", data: { text: "moon map" } },
      { id: "c", data: { text: "bread tin" } },
    ]);

    expect(ids(await getRelated("shared", "a"))).toEqual(["c"]);
    expect(ids(await getLiveRelated("shared", "a"))).toEqual(["b"]);
    expect(ids(await getRelated("shared", "a"))).toEqual(["c"]);
  });
});
