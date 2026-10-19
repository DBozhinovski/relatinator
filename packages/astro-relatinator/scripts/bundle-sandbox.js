// EmDash loads a sandboxed plugin entry as one module.
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const { compilerOptions } = JSON.parse(readFileSync("tsconfig.json", "utf8"));

await build({
  entryPoints: ["src/emdash-plugin-entry.ts"],
  outfile: "dist/emdash-plugin-entry.js",
  allowOverwrite: true,
  bundle: true,
  platform: "neutral",
  format: "esm",
  mainFields: ["module", "main"],
  target: compilerOptions.target.toLowerCase(),
  logLevel: "warning",
});
