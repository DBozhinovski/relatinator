import { describe, expect, it } from "vitest";
import {
  getInstance,
  train,
  findRelated,
  getTopTermsForId,
  getTopRelatedDocumentsForTerm,
} from "../src";
import type { TfIdfDocument } from "natural";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const readMDFiles = () => {
  // Resolve the full path of the directory
  const fullPath = path.resolve(`${__dirname}/fixtures`);

  // Read all file names in the directory
  const fileNames = fs.readdirSync(fullPath);

  // Read and return the contents of each file
  return fileNames.map((fileName) => {
    const filePath = path.join(fullPath, fileName);
    const fileContent = fs.readFileSync(filePath, "utf8");

    // Parse the front matter and markdown content
    const parsedContent = matter(fileContent);
    const rawBody = parsedContent.content;
    const frontMatter = parsedContent.data;

    return {
      frontMatter,
      rawBody,
    };
  });
};

const mdDocs = readMDFiles();

const documents = [
  { id: "node", content: "this document is about node." },
  { id: "ruby", content: "this document is about ruby." },
  { id: "ruby-node", content: "this document is about ruby and node." },
  {
    id: "node-examples",
    content: "this document is about node. it has node examples",
  },
];

describe("relatinator, simple", () => {
  it("should be trainable", () => {
    train(documents);
    const docLength = (getInstance().documents as unknown as TfIdfDocument[])
      .length;
    expect(docLength).toBe(4);
  });

  it("should find related documents", async () => {
    const related = await findRelated(documents[0].content, documents[0].id, 1);
    expect(related).toEqual(["node-examples"]);
  });

  it("should be able to match documents properly", async () => {
    const related = await findRelated(documents[0].content, documents[0].id, 3);
    expect(related).toEqual(["node-examples", "ruby-node", "ruby"]);
  });
});

describe("relatinator, complex", () => {
  it("should be trainable on files", () => {
    const documents = mdDocs.map((doc) => {
      return {
        id: doc.frontMatter.title,
        content: `${doc.frontMatter.title} ${doc.frontMatter.categories.join(
          " "
        )} ${doc.frontMatter.tags.join(" ")} ${doc.rawBody}`,
      };
    });

    train(documents);

    const docLength = (getInstance().documents as unknown as TfIdfDocument[])
      .length;

    expect(docLength).toBe(9);
  });

  it("should find related documents", async () => {
    const related = await findRelated(
      mdDocs[0].rawBody,
      mdDocs[0].frontMatter.title,
      1
    );

    expect(related[0]).toEqual("Example Markdown Document");
  });

  it("should be able to match documents properly", async () => {
    const related = await findRelated(
      mdDocs[0].rawBody,
      mdDocs[0].frontMatter.title,
      3
    );

    getInstance()
      .listTerms(4)
      .forEach((item) => {
        console.log(item.term + ": " + item.tfidf);
      });

    expect(related).toEqual([
      "Example Markdown Document",
      "Sample Markdown Post",
      "Insights into Markdown Usage",
    ]);
  });
});

describe("relatinator, terms", () => {
  it("should return top terms for a document", () => {
    const terms = getTopTermsForId(
      "12 New Science Books To End the Year With Wonder About Ourselves and Our World"
    );

    expect(terms.map((t) => t.term)).toEqual([
      "book",
      "cover",
      "world",
      "us",
      "life",
    ]);
  });

  it("should throw when trying to match a non-existent id", () => {
    expect(() => getTopTermsForId("asdf")).toThrow();
  });

  it("should return top related documents for a term", () => {
    const related = getTopRelatedDocumentsForTerm("book");

    expect(related).toEqual([
      "12 New Science Books To End the Year With Wonder About Ourselves and Our World",
      "node",
      "ruby",
      "ruby-node",
      "node-examples",
    ]);
  });
});
