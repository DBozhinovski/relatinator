import { describe, expect, it, beforeEach, beforeAll } from "vitest";
import {
  getInstance,
  resetInstance,
  train,
  findRelated,
  getTopTermsForId,
  getTopRelatedDocumentsForTerm,
  type Document,
} from "../src";
import type { TfIdf } from "natural";
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

const algorithms = ["tfidf", "bm25"] as const;

beforeAll(async () => {
  // Initialize with BM25 to ensure NLP is loaded
  await resetInstance();
  await getInstance("bm25");
});

algorithms.forEach((algorithm) => {
  describe(`relatinator with ${algorithm.toUpperCase()}`, () => {
    beforeEach(async () => {
      await resetInstance();
      const instance = await getInstance(algorithm);
      if (algorithm === "tfidf") {
        // Reset TF-IDF documents
        (instance as unknown as TfIdf).documents = [];
      }
    });

    it("should be trainable", async () => {
      await train(documents);
      const instance = await getInstance();
      if (algorithm === "tfidf") {
        const docLength = (instance as unknown as TfIdf).documents.length;
        expect(docLength).toBe(4);
      } else {
        expect(async () => await getTopTermsForId("node")).not.toThrow();
      }
    });

    it("should find related documents", async () => {
      await train(documents);
      const related = await findRelated(
        documents[0].content,
        documents[0].id,
        1
      );
      expect(related).toHaveLength(1);
      expect(related[0]).toBe("node-examples");
    });

    it("should be able to match documents properly", async () => {
      await train(documents);
      const related = await findRelated(
        documents[0].content,
        documents[0].id,
        3
      );
      expect(related).toHaveLength(3);
      expect(related).toContain("node-examples");
      if (algorithm === "tfidf") {
        expect(related).toContain("ruby-node");
      }
    });
  });

  describe(`relatinator with ${algorithm.toUpperCase()}, complex documents`, () => {
    let preparedDocuments: Array<Document>;

    beforeEach(async () => {
      await resetInstance();
      const instance = await getInstance(algorithm);
      if (algorithm === "tfidf") {
        // Reset TF-IDF documents
        (instance as unknown as TfIdf).documents = [];
      }
      preparedDocuments = mdDocs.map((doc) => ({
        id: doc.frontMatter.title,
        content: `${doc.frontMatter.title} ${doc.frontMatter.categories.join(
          " "
        )} ${doc.frontMatter.tags.join(" ")} ${doc.rawBody}`,
      }));
    });

    it("should be trainable on files", async () => {
      await train(preparedDocuments);
      const instance = await getInstance();
      if (algorithm === "tfidf") {
        const docLength = (instance as unknown as TfIdf).documents.length;
        expect(docLength).toBe(5);
      } else {
        expect(
          async () => await getTopTermsForId(preparedDocuments[0].id)
        ).not.toThrow();
      }
    });

    it("should find related documents", async () => {
      await train(preparedDocuments);
      const related = await findRelated(
        mdDocs[0].rawBody,
        mdDocs[0].frontMatter.title,
        1
      );

      expect(related).toHaveLength(1);
      if (algorithm === "tfidf") {
        expect(related[0]).toBe("Example Markdown Document");
      }
    });

    it("should be able to match documents properly", async () => {
      await train(preparedDocuments);
      const related = await findRelated(
        mdDocs[0].rawBody,
        mdDocs[0].frontMatter.title,
        3
      );

      expect(related).toHaveLength(3);
      if (algorithm === "tfidf") {
        // Don't test exact order for TF-IDF, just check for expected documents
        expect(related).toContain("Example Markdown Document");
        expect(related).toContain("Sample Markdown Post");
        expect(related).toContain("Insights into Markdown Usage");
      }
    });
  });

  describe(`relatinator terms with ${algorithm.toUpperCase()}`, () => {
    let preparedDocuments: Array<Document>;

    beforeEach(async () => {
      await resetInstance();
      const instance = await getInstance(algorithm);
      if (algorithm === "tfidf") {
        // Reset TF-IDF documents
        (instance as unknown as TfIdf).documents = [];
      }
      preparedDocuments = mdDocs.map((doc) => ({
        id: doc.frontMatter.title,
        content: `${doc.frontMatter.title} ${doc.frontMatter.categories.join(
          " "
        )} ${doc.frontMatter.tags.join(" ")} ${doc.rawBody}`,
      }));
      await train(preparedDocuments);
    });

    it("should return top terms for a document", async () => {
      const terms = await getTopTermsForId(
        "12 New Science Books To End the Year With Wonder About Ourselves and Our World"
      );

      expect(terms).toHaveLength(5);
      expect(terms[0]).toHaveProperty("term");
      expect(terms[0]).toHaveProperty("score");

      if (algorithm === "tfidf") {
        expect(terms.map((t) => t.term)).toEqual([
          "book",
          "cover",
          "world",
          "us",
          "life",
        ]);
      }
    });

    it("should throw when trying to match a non-existent id", async () => {
      await expect(getTopTermsForId("asdf")).rejects.toThrow();
    });

    it("should return top related documents for a term", async () => {
      const related = await getTopRelatedDocumentsForTerm("book");
      expect(related).toHaveLength(5);
      expect(related).toContain(
        "12 New Science Books To End the Year With Wonder About Ourselves and Our World"
      );
    });
  });
});
