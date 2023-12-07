import type { AstroIntegration } from "astro";
import path from "node:path";
import { train, tfIdf } from "relatinator";
import { glob } from "glob";
import matter from "gray-matter";
import fs from "node:fs/promises";
import { TfIdfDocument } from "natural";
import { Document } from "relatinator";

const stringifyData = (data: any): string => {
  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(stringifyData).join(' ');
    } else {
      return Object.values(data).map(stringifyData).join(' ');
    }
  } else {
    return String(data);
  }
}

async function trainModel(paths: string[], schema: string[]) {
  const documents: Document[] = [];

  if (tfIdf.documents) {
    if ((tfIdf.documents as unknown as TfIdfDocument[]).length > 0) {
      (tfIdf.documents as unknown as TfIdfDocument[]) = [];
      (tfIdf.documents as unknown as TfIdfDocument[]).length = 0;
    }
  }

  for (const path of paths) {
    const markdownFiles = await glob(`${path}/**/*.{md,mdx}`);

    for (const file of markdownFiles) {
      const content = await fs.readFile(file, "utf-8");
      const parsed = matter(content);
      const idArr = file.split("/");
      const id = idArr[idArr.length - 1];

      let documentContent = '';
      for (const key of schema) {
        if (parsed.data[key]) {
          documentContent += ' ' + stringifyData(parsed.data[key]);
        }
      }
      documentContent += ' ' + parsed.content;

      documents.push({
        id,
        content: documentContent,
      });
    }
  }

  train(documents);
}

const relatinatorIntegration = ({
  paths,
  schema,
}: {
  paths: string[];
  schema: string[];
}): AstroIntegration => {
  return {
    name: "astro-relatinator",
    hooks: {
      "astro:server:setup": async ({ server, logger }) => {
        logger.info("relatinator server:setup");

        logger.info("Training TF-IDF on existing data...");
        await trainModel(paths, schema);
        logger.info("Initial training done.");

        server.watcher.on("all", async (eventName, filePath) => {
          if (!["add", "change"].includes(eventName)) {
            return;
          }

          if (path.extname(filePath).includes("md")) {
            logger.info(
              `Markdown file changed: ${filePath}; Re-training TF-IDF...`
            );
            await trainModel(paths, schema);
          } else {
            return;
          }
        });
      },
      "astro:build:setup": async ({ logger }) => {
        logger.info("relatinator build:setup");

        logger.info("Training TF-IDF on existing data...");
        await trainModel(paths, schema);
        logger.info("Training done.");
      }
    },
  };
};

export default relatinatorIntegration;
export { findRelated, tfIdf } from "relatinator";
