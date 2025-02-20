import type { AstroIntegration } from "astro";
import path from "node:path";
import { train, resetInstance, getInstance } from "relatinator";
import { glob } from "glob";
import matter from "gray-matter";
import fs from "node:fs/promises";
import { Document } from "relatinator";

// Helper to write debug info to a file
async function writeDebug(message: string) {
  console.log("[astro-relatinator]", message);
}

async function trainModel(paths: string[], schema: string[], debug = false) {
  const documents: Document[] = [];

  if (debug) {
    await writeDebug("[trainModel] Training TF-IDF on existing data...");
  }

  for (const path of paths) {
    const markdownFiles = await glob(`${path}/**/*.{md,mdx}`);

    if (debug) {
      await writeDebug(
        `[trainModel] Found ${markdownFiles.length} files in ${path}`
      );
    }

    for (const file of markdownFiles) {
      const content = await fs.readFile(file, "utf-8");
      const parsed = matter(content);

      // Use the document's title as the ID
      const id = parsed.data.title;

      let documentContent = "";
      for (const key of schema) {
        if (parsed.data[key]) {
          documentContent += " " + stringifyData(parsed.data[key]);
        }
      }
      documentContent += " " + parsed.content;

      if (debug) {
        await writeDebug(`[trainModel] Adding document with ID: ${id}`);
      }

      documents.push({
        id,
        content: documentContent,
      });
    }
  }

  if (debug) {
    await writeDebug(
      `[trainModel] Training with documents: ${documents
        .map((d) => d.id)
        .join(", ")}`
    );
  }

  // Train the existing instance
  train(documents, debug);
}

const stringifyData = (data: any): string => {
  if (typeof data === "object") {
    if (Array.isArray(data)) {
      return data.map(stringifyData).join(" ");
    } else {
      return Object.values(data).map(stringifyData).join(" ");
    }
  } else {
    return `${data}`;
  }
};

const relatinatorIntegration = ({
  paths,
  schema,
  similarityMethod = "tfidf",
  debug = false,
}: {
  paths: string[];
  schema: string[];
  similarityMethod?: "tfidf" | "bm25";
  debug?: boolean;
}): AstroIntegration => {
  return {
    name: "astro-relatinator",
    hooks: {
      "astro:server:setup": async ({ server, logger }) => {
        logger.info("relatinator server:setup");

        logger.info(
          `Training Relatinator using ${similarityMethod} on existing data...`
        );
        await getInstance(similarityMethod);
        await trainModel(paths, schema, debug);
        logger.info("Initial training done.");

        server.watcher.on("all", async (eventName, filePath) => {
          if (!["add", "change"].includes(eventName)) {
            return;
          }

          if (path.extname(filePath).includes("md")) {
            logger.info(
              `Markdown file changed: ${filePath}; Re-training ${similarityMethod}...`
            );
            await getInstance(similarityMethod);
            await trainModel(paths, schema, debug);
          } else {
            return;
          }
        });
      },
      "astro:build:setup": async ({ logger }) => {
        logger.info("relatinator build:setup");

        logger.info(
          `Training Relatinator using ${similarityMethod} on existing data...`
        );
        await getInstance(similarityMethod);
        await trainModel(paths, schema, debug);
        logger.info(`Training done.`);
      },
    },
  };
};

export { findRelated, getInstance } from "relatinator";
export default relatinatorIntegration;
