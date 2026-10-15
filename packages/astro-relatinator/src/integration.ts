import type { AstroIntegration } from "astro";

const LEGACY_OPTIONS_WARNING =
  "Integration options are ignored since astro-relatinator 3.0. Call getRelated() in your pages instead. See https://github.com/DBozhinovski/relatinator/tree/master/packages/astro-relatinator#migrating-from-2x";

/**
 * Registers astro-relatinator with Astro. It takes no options. A 2.x
 * options object only produces a warning.
 */
export default function relatinator(legacyOptions?: never): AstroIntegration {
  return {
    name: "astro-relatinator",
    hooks: {
      "astro:config:setup": ({ logger }) => {
        if (legacyOptions !== undefined) logger.warn(LEGACY_OPTIONS_WARNING);
      },
    },
  };
}
