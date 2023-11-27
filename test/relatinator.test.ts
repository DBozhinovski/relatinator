import { describe, expect, it } from "vitest";
import { tfIdf, train, findRelated } from "../src";
import { TfIdfDocument } from "natural";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const readMDFiles = () => {
  // Resolve the full path of the directory
  const fullPath = path.resolve("./test/fixtures");

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
    const docLength = (tfIdf.documents as unknown as TfIdfDocument[]).length;
    expect(docLength).toBe(4);
  });

  it("should find related documents", () => {
    const related = findRelated(documents[0].content, documents[0].id, 1);
    expect(related).toEqual(["node-examples"]);
  });

  it("should be able to match documents properly", () => {
    const related = findRelated(documents[0].content, documents[0].id, 3);
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
    const docLength = (tfIdf.documents as unknown as TfIdfDocument[]).length;

    expect(docLength).toBe(8);
  });

  it("should find related documents", () => {
    const related = findRelated(
      mdDocs[0].rawBody,
      mdDocs[0].frontMatter.title,
      1
    );

    expect(related[0]).toEqual("Example Markdown Document");
  });

  it("should be able to match documents properly", () => {
    const related = findRelated(
      mdDocs[0].rawBody,
      mdDocs[0].frontMatter.title,
      3
    );

    expect(related).toEqual([
      "Example Markdown Document",
      "Markdown Demonstration Article",
      "Sample Markdown Post",
    ]);
  });
});
