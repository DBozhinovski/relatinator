// Checks that the sandbox entry of the EmDash plugin is one module.
// In `sandboxed: []`, EmDash reads this file and loads its code as one
// module (emdash 1.3.1 `virtual-modules.ts`). An import in the file fails.
import { statSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ENTRY = "dist/emdash-plugin-entry.js";

// Each import becomes external, so the metafile lists each import of the
// file: `import`, `export ... from`, `import()`, and `require()`.
const externalImports = {
  name: "external-imports",
  setup(plugin) {
    plugin.onResolve({ filter: /.*/ }, (args) =>
      args.kind === "entry-point"
        ? undefined
        : { path: args.path, external: true }
    );
  },
};

const result = await build({
  entryPoints: [ENTRY],
  bundle: true,
  platform: "neutral",
  format: "esm",
  write: false,
  metafile: true,
  logLevel: "silent",
  plugins: [externalImports],
});

const [output] = Object.values(result.metafile.outputs);
if (output.imports.length > 0) {
  throw new Error(
    `${ENTRY} imports other modules: ${output.imports.map((i) => i.path).join(", ")}`
  );
}

// EmDash finds the file with `require.resolve()`, so the export of the
// entry point must match the "require" conditions.
const entryUrl = new URL(`../${ENTRY}`, import.meta.url);
const require = createRequire(new URL("../package.json", import.meta.url));
const resolved = require.resolve("astro-relatinator/emdash-plugin/sandbox");
if (resolved !== fileURLToPath(entryUrl)) {
  throw new Error(`The sandbox entry point resolves to ${resolved}`);
}

const { default: plugin } = await import(entryUrl);
if (typeof plugin?.routes?.panel?.handler !== "function") {
  throw new Error(`${ENTRY} does not default-export the panel route`);
}
console.log(`${ENTRY}: ${statSync(ENTRY).size} bytes, no imports`);
