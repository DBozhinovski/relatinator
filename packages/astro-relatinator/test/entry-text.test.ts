import { describe, expect, it } from "vitest";
import { entryText } from "../src/entry-text.js";

const entry = {
  id: "post",
  data: {
    title: "Black holes",
    published: new Date("2024-01-01"),
    draft: false,
    rating: 4.5,
    cover: null,
    tags: ["space", ["physics", true]],
    author: { name: "Vera", links: [{ label: "site" }] },
    format: () => "ignored",
  },
  body: "Event horizons bend light.",
};

describe("entryText", () => {
  it("collects strings and numbers from nested data, then the body", () => {
    expect(entryText(entry)).toBe(
      "Black holes 4.5 space physics Vera site Event horizons bend light."
    );
  });

  it("uses only the listed fields, in the listed order", () => {
    expect(entryText(entry, ["tags", "title", "missing"])).toBe(
      "space physics Black holes Event horizons bend light."
    );
  });

  it("works without a body", () => {
    expect(entryText({ id: "data-only", data: { name: "Ada" } })).toBe("Ada");
  });
});
