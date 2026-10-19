import { describe, expect, expectTypeOf, it } from "vitest";
import { getEmDashRelated, type EmDashEntry } from "../src/emdash.js";
import { setEmDashCollection } from "./emdash.js";

interface PTBlock {
  _type: "block";
  _key: string;
  children: { _type: "span"; _key: string; text: string }[];
}

interface CmsPostData {
  title: string;
  description: string;
  author: string;
  pub_date: string | Date;
  tags?: string[];
  og_image?: { src?: string } | string | null;
  canonical?: string;
  content: PTBlock[];
}

const block = (text: string): PTBlock => ({
  _type: "block",
  _key: "k",
  children: [{ _type: "span", _key: "s", text }],
});

const post = (id: string, title: string, tag: string, pub_date: string) => ({
  id,
  data: {
    title,
    description: title,
    author: "Darko",
    pub_date,
    tags: [tag],
    content: [block(title)],
  } satisfies CmsPostData,
});

setEmDashCollection("typed-posts", [
  post("black-holes", "Black holes", "space", "2026-10-01"),
  post("event-horizon", "Black holes event horizon", "space", "2026-10-02"),
  post("sourdough", "Sourdough", "baking", "2026-10-03"),
]);

describe("getEmDashRelated types", () => {
  it("types the results as published entries of D when the input has only part of D", async () => {
    const { title, description, tags, content } = post(
      "draft",
      "Black holes",
      "space",
      "2026-10-04"
    ).data;

    const related = await getEmDashRelated<CmsPostData>(
      "typed-posts",
      { id: "draft", data: { title, description, tags, content } },
      { limit: 3, fields: ["title", "description", "tags", "content"] }
    );

    expectTypeOf(related).toEqualTypeOf<EmDashEntry<CmsPostData>[]>();
    expectTypeOf(related[0].data.pub_date).toEqualTypeOf<string | Date>();
    expect(related.map((entry) => entry.data.pub_date)).toEqual([
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("types the results as published entries of D for an id", async () => {
    const related = await getEmDashRelated<CmsPostData>(
      "typed-posts",
      "black-holes",
      { fields: ["title", "content"] }
    );

    expectTypeOf(related).toEqualTypeOf<EmDashEntry<CmsPostData>[]>();
    expect(related.map((entry) => entry.id)).toEqual(["event-horizon"]);
  });

  it("infers D from the data of the entry object", async () => {
    const related = await getEmDashRelated("typed-posts", {
      id: "draft",
      data: { title: "Sourdough bread" },
    });

    expectTypeOf(related[0].data.title).toEqualTypeOf<string>();
    expect(related.map((entry) => entry.data.title)).toEqual(["Sourdough"]);
  });

  it("gives `text` entries whose data is a part of D", async () => {
    const related = await getEmDashRelated<CmsPostData>(
      "typed-posts",
      "sourdough",
      {
        text: (entry) => {
          expectTypeOf(entry).toEqualTypeOf<
            EmDashEntry<Partial<CmsPostData>>
          >();
          return entry.id === "black-holes"
            ? "Sourdough"
            : (entry.data.title ?? "");
        },
      }
    );

    expect(related.map((entry) => entry.id)).toEqual(["black-holes"]);
  });

  it("gives `filter` published entries of D", async () => {
    const related = await getEmDashRelated<CmsPostData>(
      "typed-posts",
      { id: "draft", data: { title: "Black holes" } },
      {
        fields: ["title"],
        filter: (entry) => {
          expectTypeOf(entry).toEqualTypeOf<EmDashEntry<CmsPostData>>();
          return entry.data.pub_date !== "2026-10-02";
        },
      }
    );

    expect(related.map((entry) => entry.id)).toEqual(["black-holes"]);
  });

  it("rejects entry data that conflicts with D", () => {
    const call = () =>
      getEmDashRelated<CmsPostData>("typed-posts", {
        id: "draft",
        // @ts-expect-error `title` is a string in CmsPostData.
        data: { title: 1 },
      });

    expectTypeOf(call).returns.resolves.toEqualTypeOf<
      EmDashEntry<CmsPostData>[]
    >();
  });

  it("keeps optional and readonly keys when it infers D from a full entry", async () => {
    interface Post {
      title: string;
      tags?: string[];
      readonly pub_date: string;
    }
    const entry: { id: string; data: Post; edit: { draft: boolean } } = {
      id: "draft",
      data: { title: "Black holes", pub_date: "2026-10-04" },
      edit: { draft: true },
    };

    const related = await getEmDashRelated("typed-posts", entry, {
      fields: ["title"],
    });

    expectTypeOf(related).toEqualTypeOf<EmDashEntry<Post>[]>();
    expectTypeOf(related[0].data.tags).toEqualTypeOf<string[] | undefined>();
    expect(related.map((entry) => entry.id)).toEqual([
      "black-holes",
      "event-horizon",
    ]);
  });
});
