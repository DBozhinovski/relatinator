import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import plugin from "../src/emdash-plugin-entry.js";
import relatinatorTopics from "../src/emdash-plugin.js";

const block = (text: string) => ({
  _type: "block",
  _key: "k",
  style: "normal",
  markDefs: [],
  children: [{ _type: "span", _key: "s", text, marks: [] }],
});

interface FakeTerm {
  id: string;
  taxonomy: string;
  slug: string;
  label: string;
  data: { description?: string } | null;
}

const term = (
  taxonomy: string,
  id: string,
  label: string,
  description?: string
): FakeTerm => ({
  id,
  taxonomy,
  slug: label.toLowerCase(),
  label,
  data: description === undefined ? null : { description },
});

const space = term("topics", "t-space", "Space", "black holes and galaxies");
const baking = term("topics", "t-baking", "Baking", "sourdough bread, flour");
const science = term("category", "c-science", "Science", "physics of stars");
const food = term("category", "c-food", "Food");

interface FakeSite {
  taxonomies?: { name: string; label: string; collections: string[] }[];
  terms?: FakeTerm[];
  assigned?: FakeTerm[];
  data?: Record<string, unknown>;
}

const entry = { collection: "posts", id: "01POST", locale: "en", version: 3 };

function fakeSite({
  taxonomies = [
    { name: "topics", label: "Topics", collections: ["posts"] },
    { name: "category", label: "Categories", collections: ["posts", "pages"] },
    { name: "genre", label: "Genres", collections: ["books"] },
  ],
  terms = [space, baking, science, food],
  assigned = [],
  data = {
    title: "Black holes",
    content: [block("Black holes bend light. Stars fall in.")],
  },
}: FakeSite = {}) {
  const calls: unknown[][] = [];
  const entryTerms = [...assigned];
  const ctx = {
    content: {
      async get(collection: string, id: string) {
        calls.push(["content.get", collection, id]);
        return { id, data };
      },
    },
    taxonomies: {
      async getAll(options?: { locale?: string }) {
        calls.push(["getAll", options]);
        return taxonomies;
      },
      async getTerms(taxonomy: string, options?: { locale?: string }) {
        calls.push(["getTerms", taxonomy, options]);
        return terms.filter((t) => t.taxonomy === taxonomy);
      },
      async getEntryTerms(
        collection: string,
        id: string,
        options?: { locale?: string; taxonomy?: string }
      ) {
        calls.push(["getEntryTerms", collection, id, options]);
        return entryTerms;
      },
      async addEntryTerms(
        collection: string,
        id: string,
        taxonomy: string,
        termIds: string[]
      ) {
        calls.push(["addEntryTerms", collection, id, taxonomy, termIds]);
        entryTerms.push(...terms.filter((t) => termIds.includes(t.id)));
        return entryTerms.filter((t) => t.taxonomy === taxonomy);
      },
    },
  };
  return { ctx, calls };
}

const ui = {
  surface: "content-editor-panel" as const,
  locale: "en",
  direction: "ltr" as const,
  extensionId: "suggested-topics",
  entry,
};

const panel = (input: unknown, site: ReturnType<typeof fakeSite>) =>
  plugin.routes.panel.handler({ input, ui }, site.ctx);

/** The blocks of the default site, with no assigned term. */
const suggestionBlocks = [
  {
    type: "form",
    block_id: "suggestions",
    fields: [
      {
        type: "checkbox",
        action_id: "topics",
        label: "Topics",
        options: [{ label: "Space (100%)", value: "t-space" }],
      },
      {
        type: "checkbox",
        action_id: "category",
        label: "Categories",
        options: [{ label: "Science (100%)", value: "c-science" }],
      },
    ],
    submit: { label: "Add selected terms", action_id: "add_terms" },
  },
  {
    type: "context",
    text: "Some terms have no description. Descriptions improve suggestions.",
  },
];

describe("the suggested topics panel", () => {
  it("shows the suggested terms of each taxonomy of the collection", async () => {
    const site = fakeSite();

    expect(await panel({ type: "panel_load" }, site)).toEqual({
      blocks: [
        {
          type: "form",
          block_id: "suggestions",
          fields: [
            {
              type: "checkbox",
              action_id: "topics",
              label: "Topics",
              options: [{ label: "Space (100%)", value: "t-space" }],
            },
            {
              type: "checkbox",
              action_id: "category",
              label: "Categories",
              options: [{ label: "Science (100%)", value: "c-science" }],
            },
          ],
          submit: { label: "Add selected terms", action_id: "add_terms" },
        },
        {
          type: "context",
          text: "Some terms have no description. Descriptions improve suggestions.",
        },
      ],
    });
    expect(site.calls).toEqual([
      ["content.get", "posts", "01POST"],
      ["getAll", { locale: "en" }],
      ["getEntryTerms", "posts", "01POST", { locale: "en" }],
      ["getTerms", "topics", { locale: "en" }],
      ["getTerms", "category", { locale: "en" }],
    ]);
  });

  it("names the assigned terms and does not suggest them", async () => {
    const site = fakeSite({ assigned: [space] });

    expect(await panel({ type: "panel_load" }, site)).toEqual({
      blocks: [
        {
          type: "form",
          block_id: "suggestions",
          fields: [
            {
              type: "checkbox",
              action_id: "category",
              label: "Categories",
              options: [{ label: "Science (100%)", value: "c-science" }],
            },
          ],
          submit: { label: "Add selected terms", action_id: "add_terms" },
        },
        { type: "context", text: "Assigned terms: Space" },
        {
          type: "context",
          text: "Some terms have no description. Descriptions improve suggestions.",
        },
      ],
    });
  });

  it("tells the editor when the collection has no taxonomy", async () => {
    const site = fakeSite({
      taxonomies: [{ name: "genre", label: "Genres", collections: ["books"] }],
    });

    expect(await panel({ type: "panel_load" }, site)).toEqual({
      blocks: [
        {
          type: "empty",
          size: "sm",
          title: "No taxonomies",
          description: "Add a taxonomy to this collection to get suggestions.",
        },
      ],
    });
  });

  it("tells the editor when the taxonomies have no terms", async () => {
    const site = fakeSite({ terms: [] });

    expect(await panel({ type: "panel_load" }, site)).toEqual({
      blocks: [
        {
          type: "empty",
          size: "sm",
          title: "No terms",
          description: "Add terms to the taxonomies of this collection.",
        },
      ],
    });
  });

  it("tells the editor when no term matches the entry", async () => {
    const site = fakeSite({
      terms: [space, baking, science],
      data: { title: "Gardening", content: [block("Tomatoes need sun.")] },
    });

    expect(await panel({ type: "panel_load" }, site)).toEqual({
      blocks: [
        {
          type: "empty",
          size: "sm",
          title: "No suggestions",
          description: "No term matches the saved text of this entry.",
        },
      ],
    });
  });

  it("tells the user when the entry has each matching term", async () => {
    const site = fakeSite({ assigned: [space, science] });

    expect(await panel({ type: "panel_load" }, site)).toEqual({
      blocks: [
        {
          type: "empty",
          size: "sm",
          title: "No new suggestions",
          description: "The entry has each term that matches its saved text.",
        },
        { type: "context", text: "Assigned terms: Space, Science" },
        {
          type: "context",
          text: "Some terms have no description. Descriptions improve suggestions.",
        },
      ],
    });
  });

  it("adds the selected terms and shows the panel again", async () => {
    const site = fakeSite();
    const submit = {
      type: "form_submit",
      action_id: "add_terms",
      values: { topics: ["t-space"], category: ["c-science"] },
    };

    expect(await panel(submit, site)).toEqual({
      blocks: [
        {
          type: "empty",
          size: "sm",
          title: "No new suggestions",
          description: "The entry has each term that matches its saved text.",
        },
        { type: "context", text: "Assigned terms: Space, Science" },
        {
          type: "context",
          text: "Some terms have no description. Descriptions improve suggestions.",
        },
      ],
      toast: { message: "Added 2 terms.", type: "success" },
      navigate: {
        kind: "content",
        collection: "posts",
        id: "01POST",
        locale: "en",
      },
    });
    expect(site.calls.filter(([name]) => name === "addEntryTerms")).toEqual([
      ["addEntryTerms", "posts", "01POST", "topics", ["t-space"]],
      ["addEntryTerms", "posts", "01POST", "category", ["c-science"]],
    ]);
  });

  it("adds only the new terms of each taxonomy from the submitted values", async () => {
    const site = fakeSite({ assigned: [space] });
    const submit = {
      type: "form_submit",
      action_id: "add_terms",
      values: {
        topics: ["t-space", "t-baking", "c-food", 7, "t-baking"],
        category: "c-science",
        genre: ["g-poetry"],
      },
    };

    const response = await panel(submit, site);

    expect(site.calls.filter(([name]) => name === "addEntryTerms")).toEqual([
      ["addEntryTerms", "posts", "01POST", "topics", ["t-baking"]],
    ]);
    expect(response.toast).toEqual({
      message: "Added 1 term.",
      type: "success",
    });
  });

  it("asks for a selection when the editor selects no term", async () => {
    const site = fakeSite();
    const submit = { type: "form_submit", action_id: "add_terms", values: {} };

    const response = await panel(submit, site);

    expect(site.calls.filter(([name]) => name === "addEntryTerms")).toEqual([]);
    expect(response).toEqual({
      blocks: suggestionBlocks,
      toast: { message: "Select a term to add.", type: "info" },
    });
  });

  it("shows the panel for a submit without values", async () => {
    const site = fakeSite();
    const submit = { type: "form_submit", action_id: "add_terms" };

    expect(await panel(submit, site)).toEqual({ blocks: suggestionBlocks });
    expect(site.calls.filter(([name]) => name === "addEntryTerms")).toEqual([]);
  });

  it("refuses a request without the entry that EmDash attaches", async () => {
    const site = fakeSite();
    const submit = {
      type: "form_submit",
      action_id: "add_terms",
      values: { topics: ["t-space"] },
    };

    await expect(
      plugin.routes.panel.handler({ input: submit }, site.ctx)
    ).rejects.toMatchObject({
      name: "PluginRouteError",
      code: "BAD_REQUEST",
      status: 400,
      message: "Open this panel from the entry editor.",
    });
    expect(site.calls).toEqual([]);
  });
});

describe("relatinatorTopics", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8")
  );

  it("describes a standard plugin with one editor panel", () => {
    const descriptor = relatinatorTopics();

    expect(descriptor).toEqual({
      id: "relatinator-topics",
      version: pkg.version,
      format: "standard",
      entrypoint: "astro-relatinator/emdash-plugin/sandbox",
      capabilities: ["content:read", "taxonomies:write"],
      routes: [{ name: "panel", permission: "content:edit_own" }],
      editorPanels: [
        { id: "suggested-topics", title: "Suggested topics", route: "panel" },
      ],
    });
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(plugin.routes.panel.permission).toBe("content:edit_own");
  });

  it("shows the panel only in the given collections", () => {
    const collections = ["posts"];
    const descriptor = relatinatorTopics({ collections });
    collections.push("pages");

    expect(descriptor.editorPanels).toEqual([
      {
        id: "suggested-topics",
        title: "Suggested topics",
        route: "panel",
        collections: ["posts"],
      },
    ]);
  });
});
