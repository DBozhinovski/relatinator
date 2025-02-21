import { describe, expect, it, beforeEach, beforeAll } from "vitest";
import { TfIdfUtils, BM25Utils } from "../src";
import type { TfIdf } from "natural";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { RelatinatorDocument } from "../src";

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

const algorithms = ["tfidf", "bm25"] as const;

beforeAll(async () => {
  // Initialize with BM25 to ensure NLP is loaded
  await BM25Utils.resetInstance();
  await BM25Utils.getInstance();
});

algorithms.forEach((algorithm) => {
  const utils = algorithm === "tfidf" ? TfIdfUtils : BM25Utils;

  describe(`relatinator with ${algorithm.toUpperCase()}`, () => {
    beforeEach(async () => {
      if (algorithm === "tfidf") {
        TfIdfUtils.resetInstance();
      } else {
        await BM25Utils.resetInstance();
        await BM25Utils.getInstance();
      }
    });

    it("should be trainable", async () => {
      if (algorithm === "tfidf") {
        TfIdfUtils.train(documents);
        const instance = TfIdfUtils.getInstance();
        const docLength = (instance as unknown as TfIdf).documents.length;
        expect(docLength).toBe(4);
      } else {
        await BM25Utils.train(documents);
        expect(
          async () => await BM25Utils.getTopTermsForId("node")
        ).not.toThrow();
      }
    });

    it("should find related documents", async () => {
      if (algorithm === "tfidf") {
        TfIdfUtils.train(documents);
        const related = TfIdfUtils.findRelated(
          documents[0].content,
          documents[0].id,
          1
        );
        expect(related).toHaveLength(1);
        expect(related[0]).toBe("node-examples");
      } else {
        await BM25Utils.train(documents);
        const related = await BM25Utils.findRelated(
          documents[0].content,
          documents[0].id,
          1
        );
        expect(related).toHaveLength(1);
        expect(related[0]).toBe("node-examples");
      }
    });

    it("should be able to match documents properly", async () => {
      if (algorithm === "tfidf") {
        TfIdfUtils.train(documents);
        const related = TfIdfUtils.findRelated(
          documents[0].content,
          documents[0].id,
          3
        );
        expect(related).toHaveLength(3);
        expect(related).toContain("node-examples");
        expect(related).toContain("ruby-node");
      } else {
        await BM25Utils.train(documents);
        const related = await BM25Utils.findRelated(
          documents[0].content,
          documents[0].id,
          3
        );
        expect(related).toHaveLength(3);
        expect(related).toContain("node-examples");
      }
    });
  });

  describe(`relatinator with ${algorithm.toUpperCase()}, complex documents`, () => {
    let preparedDocuments: Array<RelatinatorDocument>;

    beforeEach(async () => {
      if (algorithm === "tfidf") {
        TfIdfUtils.resetInstance();
      } else {
        await BM25Utils.resetInstance();
        await BM25Utils.getInstance();
      }
      preparedDocuments = mdDocs.map((doc) => ({
        id: doc.frontMatter.title,
        content: `${doc.frontMatter.title} ${doc.frontMatter.categories.join(
          " "
        )} ${doc.frontMatter.tags.join(" ")} ${doc.rawBody}`,
      }));
    });

    it("should be trainable on files", async () => {
      if (algorithm === "tfidf") {
        TfIdfUtils.train(preparedDocuments);
        const instance = TfIdfUtils.getInstance();
        const docLength = (instance as unknown as TfIdf).documents.length;
        expect(docLength).toBe(5);
      } else {
        await BM25Utils.train(preparedDocuments);
        expect(
          async () => await BM25Utils.getTopTermsForId(preparedDocuments[0].id)
        ).not.toThrow();
      }
    });

    it("should find related documents", async () => {
      if (algorithm === "tfidf") {
        TfIdfUtils.train(preparedDocuments);
        const related = TfIdfUtils.findRelated(
          mdDocs[0].rawBody,
          mdDocs[0].frontMatter.title,
          1
        );
        expect(related).toHaveLength(1);
        expect(related[0]).toBe("Example Markdown Document");
      } else {
        await BM25Utils.train(preparedDocuments);
        const related = await BM25Utils.findRelated(
          mdDocs[0].rawBody,
          mdDocs[0].frontMatter.title,
          1
        );
        expect(related).toHaveLength(1);
      }
    });

    it("should be able to match documents properly", async () => {
      if (algorithm === "tfidf") {
        TfIdfUtils.train(preparedDocuments);
        const related = TfIdfUtils.findRelated(
          mdDocs[0].rawBody,
          mdDocs[0].frontMatter.title,
          3
        );
        expect(related).toHaveLength(3);
        expect(related).toContain("Example Markdown Document");
        expect(related).toContain("Sample Markdown Post");
        expect(related).toContain("Insights into Markdown Usage");
      } else {
        await BM25Utils.train(preparedDocuments);
        const related = await BM25Utils.findRelated(
          mdDocs[0].rawBody,
          mdDocs[0].frontMatter.title,
          3
        );
        expect(related).toHaveLength(3);
      }
    });
  });

  describe(`relatinator terms with ${algorithm.toUpperCase()}`, () => {
    let preparedDocuments: Array<RelatinatorDocument>;

    beforeEach(async () => {
      if (algorithm === "tfidf") {
        TfIdfUtils.resetInstance();
      } else {
        await BM25Utils.resetInstance();
        await BM25Utils.getInstance();
      }
      preparedDocuments = mdDocs.map((doc) => ({
        id: doc.frontMatter.title,
        content: `${doc.frontMatter.title} ${doc.frontMatter.categories.join(
          " "
        )} ${doc.frontMatter.tags.join(" ")} ${doc.rawBody}`,
      }));
      if (algorithm === "tfidf") {
        TfIdfUtils.train(preparedDocuments);
      } else {
        await BM25Utils.train(preparedDocuments);
      }
    });

    it("should return top terms for a document", async () => {
      if (algorithm === "tfidf") {
        const terms = TfIdfUtils.getTopTermsForId(
          "12 New Science Books To End the Year With Wonder About Ourselves and Our World"
        );
        expect(terms).toHaveLength(5);
        expect(terms[0]).toHaveProperty("term");
        expect(terms[0]).toHaveProperty("score");
        expect(terms.map((t) => t.term)).toEqual([
          "book",
          "cover",
          "world",
          "us",
          "explor",
        ]);
      } else {
        const terms = await BM25Utils.getTopTermsForId(
          "12 New Science Books To End the Year With Wonder About Ourselves and Our World"
        );
        expect(terms).toHaveLength(5);
        expect(terms[0]).toHaveProperty("term");
        expect(terms[0]).toHaveProperty("score");
      }
    });

    it("should throw when trying to match a non-existent id", async () => {
      if (algorithm === "tfidf") {
        expect(() => TfIdfUtils.getTopTermsForId("asdf")).toThrow();
      } else {
        await expect(BM25Utils.getTopTermsForId("asdf")).rejects.toThrow();
      }
    });

    it("should return top related documents for a term", async () => {
      if (algorithm === "tfidf") {
        const related = TfIdfUtils.getTopRelatedDocumentsForTerm("book");
        expect(related).toHaveLength(5);
        expect(related).toContain(
          "12 New Science Books To End the Year With Wonder About Ourselves and Our World"
        );
      } else {
        const related = await BM25Utils.getTopRelatedDocumentsForTerm(
          "book",
          5
        );
        expect(related).toHaveLength(5);
        expect(related).toContain(
          "12 New Science Books To End the Year With Wonder About Ourselves and Our World"
        );
      }
    });
  });
});
