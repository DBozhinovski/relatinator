import { describe, expect, it } from "vitest";
import { portableTextToPlainText } from "../src/emdash.js";

describe("portableTextToPlainText", () => {
  it("joins the span text of each block, one block per line", () => {
    expect(
      portableTextToPlainText([
        {
          _type: "block",
          _key: "a1",
          style: "h2",
          markDefs: [
            { _key: "m1", _type: "link", href: "https://example.com" },
          ],
          children: [
            { _type: "span", _key: "s1", text: "Black ", marks: [] },
            { _type: "span", _key: "s2", text: "holes", marks: ["strong"] },
          ],
        },
        {
          _type: "block",
          _key: "a2",
          style: "normal",
          markDefs: [],
          children: [
            { _type: "span", _key: "s3", text: "Bend light.", marks: [] },
          ],
        },
      ])
    ).toBe("Black holes\nBend light.");
  });

  it("skips blocks that are not text blocks", () => {
    expect(
      portableTextToPlainText([
        {
          _type: "image",
          _key: "i1",
          asset: { url: "https://example.com/a.jpg" },
        },
        { _type: "code", _key: "c1", code: "const x = 1;" },
        {
          _type: "block",
          _key: "b1",
          children: [{ _type: "span", text: "Only me." }],
        },
      ])
    ).toBe("Only me.");
  });

  it("returns a string as it is and other values as empty text", () => {
    expect(portableTextToPlainText("Already plain.")).toBe("Already plain.");
    expect(portableTextToPlainText(42)).toBe("");
    expect(portableTextToPlainText(null)).toBe("");
  });
});
