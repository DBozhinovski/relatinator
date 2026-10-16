// Resolves the modules that the helpers import on call to the in-memory
// store, so the benchmark runs without Astro or a database.
const store = new URL("./store.mjs", import.meta.url).href;

export function resolve(specifier, context, next) {
  if (specifier === "emdash" || specifier === "astro:content") {
    return { url: store, shortCircuit: true };
  }
  return next(specifier, context);
}
