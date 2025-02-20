import {
  getInstance,
  train,
  findRelated,
  getTopTermsForId,
  getTopRelatedDocumentsForTerm,
} from "./src";
import type { TfIdfDocument } from "natural";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readMDFiles = () => {
  // Resolve the full path of the directory
  const fullPath = path.resolve(`${__dirname}/test/fixtures`);

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

// Initialize with BM25 and embeddings
await getInstance("tfidf");

const documents = mdDocs.map((doc) => {
  return {
    id: doc.frontMatter.title,
    content: `${doc.frontMatter.title} ${doc.frontMatter.categories.join(
      " "
    )} ${doc.frontMatter.tags.join(" ")} ${doc.rawBody}`,
  };
});

await train(documents);

const main = async () => {
  const related = await findRelated(
    mdDocs[0].rawBody,
    mdDocs[0].frontMatter.title,
    2,
    true
  );
  console.log(related);
};

main();
