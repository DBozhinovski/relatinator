import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { createModel } from "../src/index.js";

const fixtures = path.join(import.meta.dirname, "fixtures");

const posts = fs
  .readdirSync(fixtures)
  .sort()
  .map((file) => {
    const { data, content } = matter(
      fs.readFileSync(path.join(fixtures, file), "utf8")
    );
    return {
      id: String(data.title),
      content: [data.title, ...data.categories, ...data.tags, content].join(
        " "
      ),
    };
  });

const books =
  "12 New Science Books To End the Year With Wonder About Ourselves and Our World";

describe.each(["tfidf", "bm25"] as const)(
  "markdown fixtures with %s",
  (method) => {
    const model = createModel(posts, { method });

    it("relates the markdown posts to each other before the science books post", () => {
      expect(model.findRelated("Sample Markdown Post")).toEqual([
        "Example Markdown Document",
        "Markdown Demonstration Article",
        "Insights into Markdown Usage",
        books,
      ]);
    });

    it("finds the science books post for the term book", () => {
      expect(model.getTopDocumentsForTerm("books")).toEqual([books]);
    });
  }
);

it("keeps the 2.x tf-idf top terms for the science books post", () => {
  const terms = createModel(posts, { method: "tfidf" }).getTopTerms(books);
  expect(terms.map(({ term }) => term)).toEqual([
    "book",
    "cover",
    "world",
    "us",
    "explor",
  ]);
});
