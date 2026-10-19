import { describe, expect, it } from "vitest";
import { getEmDashRelated, portableTextToPlainText } from "../src/emdash.js";
import { getRelated } from "../src/index.js";
import { setCollection } from "./astro-content.js";
import {
  emdashCalls,
  failEmDashCollection,
  setEmDashCollection,
  setRequestContext,
} from "./emdash.js";

const ids = (entries: readonly { id: string }[]) => entries.map((e) => e.id);

const block = (text: string) => ({
  _type: "block",
  _key: "k",
  style: "normal",
  markDefs: [],
  children: [{ _type: "span", _key: "s", text, marks: [] }],
});

const posts = setEmDashCollection("posts", [
  {
    id: "black-holes",
    data: {
      title: "Black holes",
      tags: ["space"],
      content: [block("Black holes bend light near the event horizon.")],
    },
  },
  {
    id: "event-horizon",
    data: {
      title: "The event horizon",
      tags: ["space"],
      content: [block("Nothing escapes black holes past the event horizon.")],
    },
  },
  {
    id: "galaxies",
    data: {
      title: "Galaxies",
      tags: ["space"],
      content: [block("Spiral galaxies hold billions of stars.")],
    },
  },
  {
    id: "sourdough",
    data: {
      title: "Sourdough",
      tags: ["baking"],
      content: [block("Flour, water and salt make bread.")],
    },
  },
]);

describe("getEmDashRelated", () => {
  it("returns the collection's related entries in rank order", async () => {
    const related = await getEmDashRelated("posts", posts[0]);

    expect(ids(related)).toEqual(["event-horizon", "galaxies"]);
    expect(related[0]).toBe(posts[1]);
  });

  it("accepts entries whose data type is an interface, like EmDash's generated types", async () => {
    interface Post {
      title: string;
      tags: string[];
    }
    const typed: { id: string; data: Post } = {
      id: "typed-draft",
      data: { title: "Event horizon of black holes", tags: [] },
    };

    const related: { id: string; data: Post }[] = await getEmDashRelated(
      "posts",
      typed,
      {
        limit: 1,
      }
    );
    expect(ids(related)).toEqual(["black-holes"]);
  });

  it("accepts an entry id instead of an entry", async () => {
    expect(ids(await getEmDashRelated("posts", "black-holes"))).toEqual([
      "event-horizon",
      "galaxies",
    ]);
  });

  it("throws for an id that is not a published entry of the collection", async () => {
    await expect(getEmDashRelated("posts", "missing")).rejects.toThrow(
      'astro-relatinator: no published entry "missing" in EmDash collection "posts"'
    );
  });

  it("ranks an entry that is not published, such as a draft, by its text", async () => {
    const draft = {
      id: "draft-bread",
      data: {
        title: "Rye bread",
        content: [block("Rye flour makes a dense bread.")],
      },
    };

    expect(ids(await getEmDashRelated("posts", draft))).toEqual(["sourdough"]);
  });

  it("does not return a published entry in its own results", async () => {
    setEmDashCollection("bakes", [
      posts[3],
      { ...posts[3], id: "sourdough-copy" },
    ]);
    const preview = {
      ...posts[3],
      data: { ...posts[3].data, title: "Sourdough, edited" },
    };

    expect(ids(await getEmDashRelated("bakes", preview))).toEqual([
      "sourdough-copy",
    ]);
  });
});

describe("getEmDashRelated corpus", () => {
  it("reads every page of the collection", async () => {
    const filler = Array.from({ length: 150 }, (_, index) => ({
      id: `note-${index}`,
      data: {
        title: `Note ${index}`,
        content: [block(`Filler${index} words${index}.`)],
      },
    }));
    setEmDashCollection("notes", [
      { id: "first", data: { content: [block("Comets have icy tails.")] } },
      ...filler,
      {
        id: "last",
        data: { content: [block("Icy comets grow tails near the sun.")] },
      },
    ]);

    expect(ids(await getEmDashRelated("notes", "first"))).toEqual(["last"]);
    expect(ids(await getEmDashRelated("notes", "last"))).toEqual(["first"]);
  });

  it("reads only published entries", async () => {
    setEmDashCollection("drafts", [
      { id: "comets", data: { title: "Comets" } },
      { id: "more-comets", status: "draft", data: { title: "More comets" } },
      { id: "comet-tails", data: { title: "Comet tails" } },
    ]);

    expect(ids(await getEmDashRelated("drafts", "comets"))).toEqual([
      "comet-tails",
    ]);
    await expect(getEmDashRelated("drafts", "more-comets")).rejects.toThrow(
      'no published entry "more-comets" in EmDash collection "drafts"'
    );
  });

  it("throws an error that names the collection when EmDash returns an error", async () => {
    setEmDashCollection("broken", []);
    failEmDashCollection("broken", new Error("no such table: ec_broken"));

    await expect(getEmDashRelated("broken", "any")).rejects.toThrow(
      'astro-relatinator: cannot read EmDash collection "broken": no such table: ec_broken'
    );
  });
});

describe("getEmDashRelated locale", () => {
  const translated = [
    { id: "ice", locale: "en", data: { title: "Glace comets" } },
    { id: "fr/cometes", locale: "fr", data: { title: "Glace queue" } },
    { id: "fr/queues", locale: "fr", data: { title: "Queue glace" } },
  ];

  it("reads only the entries of `locale`", async () => {
    setEmDashCollection("translated", translated);
    const calls = () => emdashCalls.filter(({ type }) => type === "translated");

    expect(
      ids(await getEmDashRelated("translated", "fr/cometes", { locale: "fr" }))
    ).toEqual(["fr/queues"]);
    expect(calls()).toEqual([
      {
        type: "translated",
        filter: {
          status: "published",
          limit: 100,
          cursor: undefined,
          locale: "fr",
        },
      },
    ]);
    expect(ids(await getEmDashRelated("translated", "fr/cometes"))).toEqual([
      "fr/queues",
      "ice",
    ]);
    expect(calls()[1].filter.locale).toBeUndefined();
  });

  let reads = 0;
  const text = (entry: { data: Record<string, unknown> }) => {
    reads += 1;
    return String(entry.data.title);
  };
  const withFire = [
    ...translated,
    { id: "fire", locale: "en", data: { title: "Fire comets" } },
  ];

  it("keeps one model for each locale", async () => {
    setEmDashCollection("locales", withFire);
    const related = async (id: string, locale: string) => {
      reads = 0;
      const result = ids(
        await getEmDashRelated("locales", id, { locale, text })
      );
      return { result, reads };
    };

    await related("ice", "en");
    await related("fr/cometes", "fr");

    // A cached model reads the text of each entry once, for the
    // fingerprint. A new model reads it again.
    expect(await related("ice", "en")).toEqual({ result: ["fire"], reads: 2 });
    expect(await related("fr/cometes", "fr")).toEqual({
      result: ["fr/queues"],
      reads: 2,
    });
  });

  it("keeps one model for each request locale when `locale` is not set", async () => {
    setEmDashCollection("request-locales", withFire);
    const related = async (id: string, locale: string | undefined) => {
      setRequestContext(locale === undefined ? undefined : { locale });
      reads = 0;
      try {
        const result = ids(
          await getEmDashRelated("request-locales", id, { text })
        );
        return { result, reads };
      } finally {
        setRequestContext(undefined);
      }
    };

    await related("fr/cometes", undefined);
    await related("fr/cometes", "fr");

    expect(await related("fr/cometes", undefined)).toEqual({
      result: ["fr/queues", "ice"],
      reads: 4,
    });
    expect(await related("fr/cometes", "fr")).toEqual({
      result: ["fr/queues"],
      reads: 2,
    });
  });
});

describe("getEmDashRelated text", () => {
  it("reads Portable Text anywhere in the data as plain text, without its markup", async () => {
    setEmDashCollection("guides", [
      {
        id: "telescopes",
        data: {
          sections: [
            {
              heading: "Optics",
              body: [block("Telescopes gather starlight.")],
            },
          ],
        },
      },
      {
        id: "binoculars",
        data: {
          sections: [
            {
              heading: "Field use",
              body: [block("Binoculars gather starlight too.")],
            },
          ],
        },
      },
      {
        id: "markup",
        data: { title: "block span normal strong k s markDefs marks style" },
      },
    ]);

    expect(ids(await getEmDashRelated("guides", "telescopes"))).toEqual([
      "binoculars",
    ]);
    expect(ids(await getEmDashRelated("guides", "markup"))).toEqual([]);
  });

  it("skips EmDash system values and reads only the labels of terms", async () => {
    const byline = {
      id: "01BYLINE",
      slug: "editorial",
      displayName: "Editorial Team",
    };
    const term = (id: string, slug: string, label: string) => ({
      id,
      name: "tag",
      slug,
      label,
      children: [],
      locale: "en",
      translationGroup: id,
    });
    const system = (slug: string) => ({
      id: `01ENTRY${slug}`,
      slug,
      status: "published",
      authorId: "01AUTHOR",
      primaryBylineId: "01BYLINE",
      locale: "en",
      translationGroup: "01GROUP",
      draftRevisionId: "01REVISION",
      liveRevisionId: "01REVISION",
      byline,
      bylines: [
        { byline, roleLabel: "Staff writer", sortOrder: 0, source: "explicit" },
      ],
      seo: {
        title: "Shared site title",
        description: "Shared site description",
      },
    });
    setEmDashCollection("journal", [
      {
        id: "comets",
        data: {
          ...system("comets"),
          title: "Comets",
          terms: { tag: [term("01T1", "sky", "Astronomy")] },
        },
      },
      {
        id: "nebulae",
        data: {
          ...system("nebulae"),
          title: "Nebulae",
          terms: { tag: [term("01T1", "sky", "Astronomy")] },
        },
      },
      {
        id: "pancakes",
        data: {
          ...system("pancakes"),
          title: "Pancakes",
          terms: { tag: [term("01T2", "astronomy", "Breakfast")] },
        },
      },
    ]);

    expect(ids(await getEmDashRelated("journal", "comets"))).toEqual([
      "nebulae",
    ]);
    expect(ids(await getEmDashRelated("journal", "pancakes"))).toEqual([]);
    expect(
      ids(
        await getEmDashRelated("journal", "pancakes", {
          fields: ["title", "bylines"],
        })
      )
    ).toEqual(["comets", "nebulae"]);
  });

  it("reads only the listed data fields when `fields` is set", async () => {
    setEmDashCollection("recipes", [
      {
        id: "bread",
        data: { title: "Bread", note: "zebra", content: [block("flour")] },
      },
      {
        id: "cake",
        data: { title: "Cake", note: "zebra", content: [block("sugar")] },
      },
      {
        id: "pizza",
        data: { title: "Pizza", content: [block("bread dough")] },
      },
    ]);

    expect(ids(await getEmDashRelated("recipes", "bread"))).toEqual([
      "cake",
      "pizza",
    ]);
    expect(
      ids(
        await getEmDashRelated("recipes", "bread", {
          fields: ["title", "content"],
        })
      )
    ).toEqual(["pizza"]);
  });

  it("uses the `text` option instead of the default text", async () => {
    const related = await getEmDashRelated("posts", "sourdough", {
      text: (entry) =>
        entry.id === "galaxies"
          ? "bread flour"
          : portableTextToPlainText(entry.data.content),
    });

    expect(ids(related)).toEqual(["galaxies"]);
    expect(ids(await getEmDashRelated("posts", "sourdough"))).toEqual([]);
  });

  it("applies `filter` to the published entries before the limit", async () => {
    const notHorizon = (entry: { data: Record<string, unknown> }) =>
      entry.data.title !== "The event horizon";
    const draft = {
      id: "draft-holes",
      data: { content: [block("Black holes and the event horizon.")] },
    };

    const related = await getEmDashRelated("posts", "black-holes", {
      limit: 1,
      filter: notHorizon,
    });
    expect(ids(related)).toEqual(["galaxies"]);
    expect(related[0]).toBe(posts[2]);
    expect(
      ids(
        await getEmDashRelated("posts", draft, {
          limit: 1,
          filter: notHorizon,
        })
      )
    ).toEqual(["black-holes"]);
  });

  it("returns at most `limit` entries", async () => {
    expect(
      ids(await getEmDashRelated("posts", "black-holes", { limit: 1 }))
    ).toEqual(["event-horizon"]);
  });
});

describe("getEmDashRelated cache", () => {
  const notes = (text: string) => [
    { id: "a", data: { content: [block("cats purr")] } },
    { id: "b", data: { content: [block("dogs bark")] } },
    { id: "c", data: { content: [block(text)] } },
  ];

  it("rebuilds the model when the text of an entry changes", async () => {
    setEmDashCollection("pets", notes("cats nap"));
    expect(ids(await getEmDashRelated("pets", "a"))).toEqual(["c"]);
    expect(ids(await getEmDashRelated("pets", "a"))).toEqual(["c"]);

    setEmDashCollection("pets", notes("dogs nap"));
    expect(ids(await getEmDashRelated("pets", "a"))).toEqual([]);
    expect(ids(await getEmDashRelated("pets", "b"))).toEqual(["c"]);
  });

  it("keeps EmDash models apart from Astro collections of the same name", async () => {
    const fruit = (cherries: string) => [
      { id: "x", data: {}, body: "red apples", digest: "1" },
      { id: "y", data: {}, body: cherries, digest: "1" },
    ];
    setCollection("shared", fruit("red cherries"));
    setEmDashCollection("shared", notes("cats nap"));
    expect(ids(await getRelated("shared", "x"))).toEqual(["y"]);
    expect(ids(await getEmDashRelated("shared", "a"))).toEqual(["c"]);

    // The digests do not change, so the Astro model stays in use.
    setCollection("shared", fruit("blue cherries"));
    expect(ids(await getRelated("shared", "x"))).toEqual(["y"]);
  });
});
