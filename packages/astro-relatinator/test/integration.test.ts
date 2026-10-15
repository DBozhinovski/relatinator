import type { AstroIntegration } from "astro";
import { describe, expect, it } from "vitest";
import relatinator from "../src/index.js";

type ConfigSetup = NonNullable<AstroIntegration["hooks"]["astro:config:setup"]>;

async function runConfigSetup(integration: AstroIntegration) {
  const warnings: string[] = [];
  const logger = { warn: (message: string) => warnings.push(message) };
  const setup = integration.hooks["astro:config:setup"] as ConfigSetup;
  await setup({ logger } as unknown as Parameters<ConfigSetup>[0]);
  return warnings;
}

describe("relatinator integration", () => {
  it("warns once that 2.x options are ignored, and stays silent without options", async () => {
    // @ts-expect-error 2.x options are no longer part of the type
    const legacy = relatinator({
      paths: ["src/content/posts"],
      schema: ["title"],
    });

    expect(legacy.name).toBe("astro-relatinator");
    expect(await runConfigSetup(legacy)).toEqual([
      "Integration options are ignored since astro-relatinator 3.0. Call getRelated() in your pages instead. See https://github.com/DBozhinovski/relatinator/tree/master/packages/astro-relatinator#migrating-from-2x",
    ]);
    expect(await runConfigSetup(relatinator())).toEqual([]);
  });
});
