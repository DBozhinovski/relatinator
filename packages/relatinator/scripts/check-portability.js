import { build } from "esbuild";

const MAX_BYTES = 60 * 1024;

const result = await build({
  entryPoints: ["dist/index.js"],
  bundle: true,
  platform: "neutral",
  format: "esm",
  mainFields: ["module", "main"],
  minify: true,
  write: false,
  metafile: true,
  logLevel: "silent",
});

const [output] = Object.values(result.metafile.outputs);
if (output.imports.length > 0) {
  throw new Error(
    `Bundle keeps external imports: ${output.imports.map((i) => i.path).join(", ")}`
  );
}
if (output.bytes > MAX_BYTES) {
  throw new Error(
    `Bundle is ${output.bytes} bytes, over the ${MAX_BYTES} byte budget`
  );
}
console.log(
  `Portable bundle: ${output.bytes} bytes (${(output.bytes / 1024).toFixed(1)} KB), no external imports`
);
