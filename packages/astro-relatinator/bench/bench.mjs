// Astro helper benchmark. Usage (after `pnpm build`):
//   node bench/bench.mjs [--runs 5] [--size 1005] [--dist dist]
// Calls getEmDashRelated and getRelated from --dist with in-memory
// collections (see hooks.mjs and store.mjs). Each run starts a fresh
// child process per helper: one cold call builds the model, then warm
// calls reuse it. Every call gets a fresh copy of the collection, as a
// database load does, so caches keyed on entry objects do not hit.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import module from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { generateCorpus } from "../../relatinator/bench/corpus.js";
import { resolve } from "./hooks.mjs";

const SAMPLE = 50;
const HELPERS = ["emdash", "astro"];

const checksum = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const span = (text, key) => ({ _type: "span", _key: key, text, marks: [] });

function block(paragraph, k) {
  const words = paragraph.split(" ");
  const third = Math.ceil(words.length / 3);
  const parts = [0, 1, 2].map((p) =>
    words.slice(p * third, (p + 1) * third).join(" ")
  );
  return {
    _type: "block",
    _key: `b${k}`,
    style: "normal",
    markDefs: [],
    children: parts.map((text, p) => span(p ? ` ${text}` : text, `s${k}.${p}`)),
  };
}

const image = (k) => ({
  _type: "image",
  _key: `i${k}`,
  asset: { _ref: `image-${k}` },
  alt: "A figure",
});

const portableText = (content) =>
  content
    .split("\n\n")
    .flatMap((p, k) => (k % 5 === 4 ? [block(p, k), image(k)] : [block(p, k)]));

function emdashEntry(doc, i) {
  const words = doc.content.split(/\s+/);
  const date = new Date(Date.UTC(2020, 0, 1) + i * 86_400_000);
  const tags = words.slice(30, 33);
  const system = {
    id: `01EMDASH${i}`,
    slug: doc.id,
    status: "published",
    authorId: "author-1",
    primaryBylineId: "byline-1",
    createdAt: date,
    updatedAt: date,
    publishedAt: date,
    scheduledAt: null,
    draftRevisionId: null,
    liveRevisionId: `rev-${i}`,
    locale: "en",
    translationGroup: `group-${i}`,
    byline: { id: "byline-1", displayName: "Darko Bozhinovski" },
    bylines: [{ id: "byline-1", displayName: "Darko Bozhinovski" }],
    seo: { title: words.slice(0, 6).join(" "), noindex: false },
    terms: { tag: tags.map((label) => ({ id: label, slug: label, label })) },
  };
  const content = {
    title: words.slice(0, 6).join(" "),
    description: words.slice(6, 30).join(" "),
    author: "Darko Bozhinovski",
    pub_date: date.toISOString().slice(0, 10),
    tags,
    og_image: null,
    canonical: null,
    content: portableText(doc.content),
  };
  return { id: doc.id, data: { ...system, ...content } };
}

function astroEntry(doc, i) {
  const words = doc.content.split(/\s+/);
  return {
    id: doc.id,
    collection: "blog",
    data: {
      title: words.slice(0, 6).join(" "),
      description: words.slice(6, 30).join(" "),
      tags: words.slice(30, 33),
      pubDate: new Date(Date.UTC(2020, 0, 1) + i * 86_400_000),
    },
    body: doc.content,
    digest: checksum(doc.content),
  };
}

// The relatinator that the helpers in `dist` import, for the core timing.
function relatinatorOf(dist) {
  const file = module.findPackageJSON("relatinator", dist("index.js"));
  const { exports } = JSON.parse(fs.readFileSync(file, "utf8"));
  return pathToFileURL(path.join(path.dirname(file), exports["."].import)).href;
}

async function load(helper, distDir) {
  // In-thread hooks (Node 22.15+) keep the per-call `import()` cheap.
  if (module.registerHooks) module.registerHooks({ resolve });
  else module.register("./hooks.mjs", import.meta.url);
  const dist = (file) => pathToFileURL(path.resolve(distDir, file)).href;
  const { setCollections } = await import("./store.mjs");
  const { createModel } = await import(relatinatorOf(dist));
  if (helper === "emdash") {
    const { getEmDashRelated } = await import(dist("emdash.js"));
    const { emdashEntryText } = await import(dist("emdash-text.js"));
    return {
      setCollections,
      createModel,
      collection: "posts",
      toEntry: emdashEntry,
      related: (entry) => getEmDashRelated("posts", entry),
      textOf: (entry) => emdashEntryText(entry),
    };
  }
  const { getRelated } = await import(dist("get-related.js"));
  const { entryText } = await import(dist("entry-text.js"));
  return {
    setCollections,
    createModel,
    collection: "blog",
    toEntry: astroEntry,
    related: (entry) => getRelated("blog", entry),
    textOf: (entry) => entryText(entry),
  };
}

async function timed(state, run) {
  const start = performance.now();
  try {
    const value = await run();
    return { ms: performance.now() - start, value };
  } catch {
    state.errors++;
    return { ms: performance.now() - start, value: [] };
  }
}

function coreFindRelated(h, entries, sample) {
  const model = h.createModel(
    entries.map((e) => ({ id: e.id, content: h.textOf(e) }))
  );
  return median(
    sample.map((i) => {
      const start = performance.now();
      model.findRelated(entries[i].id, { limit: 5 });
      return performance.now() - start;
    })
  );
}

async function child(helper, size, dist) {
  const h = await load(helper, dist);
  const docs = generateCorpus(size, {
    seed: 2026,
    minWords: 300,
    maxWords: 3000,
  });
  const entries = docs.map(h.toEntry);
  const fresh = () => {
    const copy = structuredClone(entries);
    h.setCollections(new Map([[h.collection, copy]]));
    globalThis.gc?.();
    return copy;
  };
  const state = { errors: 0 };
  const sample = Array.from({ length: SAMPLE }, (_, k) =>
    Math.floor((k * size) / SAMPLE)
  );
  // `fresh()` runs before the clock starts.
  const call = (i) => {
    const copy = fresh();
    return timed(state, () => h.related(copy[i]));
  };
  const cold = await call(sample[0]);
  const warm = [];
  for (const i of sample) warm.push(await call(i));
  const copy = fresh();
  const text = await timed(state, () => copy.map(h.textOf));
  const lists = [cold, ...warm].map((r) => r.value.map((e) => e.id));
  return {
    cold: cold.ms,
    warm: median(warm.map((r) => r.ms)),
    text: text.ms,
    core: coreFindRelated(h, entries, sample),
    work: lists.reduce((total, list) => total + list.length, 0),
    checksum: checksum(lists),
    errors: state.errors,
  };
}

function measure(helper, size, dist) {
  const args = ["--child", helper, "--size", String(size), "--dist", dist];
  const node = ["--expose-gc", import.meta.filename];
  const out = spawnSync(process.execPath, [...node, ...args], {
    encoding: "utf8",
  });
  if (out.status !== 0) {
    process.stderr.write(out.stderr);
    return { cold: NaN, warm: NaN, text: NaN, core: NaN, errors: 1 };
  }
  return JSON.parse(out.stdout.trim().split("\n").at(-1));
}

const UNITS = {
  cold: "ms",
  warm: "ms/call",
  text: "ms/corpus",
  core: "ms/call",
};

function summarize(helper, size, runs) {
  return Object.entries(UNITS).map(([metric, unit]) => {
    const values = runs.map((r) => r[metric]);
    return {
      kind: "metric",
      helper,
      size,
      metric,
      unit,
      median: median(values),
      min: Math.min(...values),
      max: Math.max(...values),
      runs: runs.length,
      work: [...new Set(runs.map((r) => r.work))],
      checksum: [...new Set(runs.map((r) => r.checksum))],
      errors: runs.reduce((total, r) => total + r.errors, 0),
    };
  });
}

function parent({ runs, size, dist }) {
  console.log(
    JSON.stringify({
      kind: "env",
      node: process.version,
      loadavg: os.loadavg(),
      size,
      dist,
    })
  );
  const results = new Map(HELPERS.map((helper) => [helper, []]));
  for (let run = 0; run < runs; run++) {
    const order = run % 2 ? [...HELPERS].reverse() : HELPERS;
    for (const helper of order) {
      const result = measure(helper, size, dist);
      console.log(
        JSON.stringify({ kind: "run", run, helper, size, ...result })
      );
      results.get(helper).push(result);
    }
  }
  for (const [helper, list] of results) {
    for (const line of summarize(helper, size, list)) {
      console.log(JSON.stringify(line));
    }
  }
  console.log(JSON.stringify({ kind: "end", loadavg: os.loadavg() }));
}

const { values } = parseArgs({
  options: {
    child: { type: "string" },
    size: { type: "string", default: "1005" },
    runs: { type: "string", default: "5" },
    dist: {
      type: "string",
      default: path.join(import.meta.dirname, "../dist"),
    },
  },
});
const dist = path.resolve(values.dist);

if (values.child) {
  const result = await child(values.child, Number(values.size), dist);
  console.log(JSON.stringify(result));
} else {
  parent({ runs: Number(values.runs), size: Number(values.size), dist });
}
