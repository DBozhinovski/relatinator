import { describe, expect, it } from "vitest";
import { tokenize } from "../src/index.js";

describe("tokenize", () => {
  it("lowercases, removes elisions and stopwords, and stems", () => {
    expect(tokenize("Don't stop the Node.js server's logs!")).toEqual([
      "stop",
      "node",
      "js",
      "server",
      "log",
    ]);
  });

  it("removes every listed elision, including the typographic apostrophe", () => {
    expect(
      tokenize("Bob’s cats'll purr, they're fine, I'd go, we've won, I'm here")
    ).toEqual(["bob", "cat", "purr", "fine", "go", "won"]);
  });

  it("stems inflected forms to one root", () => {
    expect(tokenize("connections connected connecting")).toEqual([
      "connect",
      "connect",
      "connect",
    ]);
  });

  it("keeps Unicode letters and numbers and splits on everything else", () => {
    expect(tokenize("Café—Zürich 2024 東京")).toEqual([
      "café",
      "zürich",
      "2024",
      "東京",
    ]);
  });

  it("returns no tokens for text with only stopwords and punctuation", () => {
    expect(tokenize("It is what it is... and that's all!")).toEqual([]);
  });
});
