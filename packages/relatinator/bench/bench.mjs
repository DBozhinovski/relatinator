// Core benchmark. Usage (after `pnpm run build`):
//   node bench/bench.mjs [--impl current|reference|both] [--runs 5]
//     [--sizes 200,1005] [--metrics allPairs,build,findRelatedOne,findRelatedToText,tokenize]
// Each measurement runs in a fresh child process, so every run starts with
// a cold JIT, as a static build or a new server process does. Runs
// interleave sizes, metrics, and implementations so drift does not favor
// one of them.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import { parseArgs } from "node:util";
import { generateCorpus } from "./corpus.js";

const SAMPLE = 50;
const IMPLS = {
  current: () => import("../dist/index.js"),
  reference: () => import("relatinator-reference"),
};

/** Synthetic blog: at 1,005 posts, a mean of 1,204 words and 815 tokens. */
const corpusFor = (size) =>
  generateCorpus(size, { seed: 2026, minWords: 300, maxWords: 3000 });

const checksum = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const sampleOf = (docs) =>
  Array.from(
    { length: Math.min(SAMPLE, docs.length) },
    (_, i) => docs[Math.floor((i * docs.length) / SAMPLE)]
  );

function attempt(state, run) {
  try {
    return run();
  } catch {
    state.errors++;
    return null;
  }
}

function timeCalls(items, call) {
  const state = { errors: 0 };
  const times = [];
  const results = items.map((item) => {
    const start = performance.now();
    const result = attempt(state, () => call(item));
    times.push(performance.now() - start);
    return result;
  });
  return { ms: median(times), results, errors: state.errors };
}

const countIds = (lists) =>
  lists.reduce((total, list) => total + (list?.length ?? 0), 0);

const METRICS = {
  allPairs(api, docs) {
    const state = { errors: 0 };
    const start = performance.now();
    const model = attempt(state, () => api.createModel(docs));
    const results = docs.map((doc) =>
      attempt(state, () => model.findRelated(doc.id, { limit: 5 }))
    );
    const ms = performance.now() - start;
    return { ms, work: countIds(results), results, errors: state.errors };
  },
  build(api, docs) {
    const state = { errors: 0 };
    const start = performance.now();
    const model = attempt(state, () => api.createModel(docs));
    const ms = performance.now() - start;
    const results = docs.map((doc) => model?.getTopTerms(doc.id, 5));
    return { ms, work: model?.size ?? 0, results, errors: state.errors };
  },
  findRelatedOne(api, docs) {
    const model = api.createModel(docs);
    const run = timeCalls(sampleOf(docs), (doc) =>
      model.findRelated(doc.id, { limit: 5 })
    );
    return { ...run, work: countIds(run.results) };
  },
  findRelatedToText(api, docs) {
    const model = api.createModel(docs);
    const run = timeCalls(sampleOf(docs), (doc) =>
      model.findRelatedToText(doc.content, { limit: 5, exclude: [doc.id] })
    );
    return { ...run, work: countIds(run.results) };
  },
  tokenize(api, docs) {
    const state = { errors: 0 };
    const start = performance.now();
    const results = docs.map((doc) =>
      attempt(state, () => api.tokenize(doc.content))
    );
    const ms = performance.now() - start;
    return { ms, work: countIds(results), results, errors: state.errors };
  },
};

async function child({ impl, metric, size }) {
  const api = await IMPLS[impl]();
  const docs = corpusFor(size);
  const { ms, work, results, errors } = METRICS[metric](api, docs);
  const sum = checksum(results);
  console.log(JSON.stringify({ ms, work, checksum: sum, errors }));
}

function measure({ impl, metric, size }) {
  const args = ["--child", "--impl", impl, "--metric", metric, "--sizes", size];
  const out = spawnSync(process.execPath, [import.meta.filename, ...args], {
    encoding: "utf8",
  });
  if (out.status !== 0) {
    process.stderr.write(out.stderr);
    return { ms: NaN, work: 0, checksum: "failed", errors: 1 };
  }
  return JSON.parse(out.stdout.trim().split("\n").at(-1));
}

function summarize(key, runs) {
  const times = runs.map((r) => r.ms);
  return {
    kind: "metric",
    ...key,
    unit: ["findRelatedOne", "findRelatedToText"].includes(key.metric)
      ? "ms/call"
      : "ms",
    median: median(times),
    min: Math.min(...times),
    max: Math.max(...times),
    runs: runs.length,
    work: [...new Set(runs.map((r) => r.work))],
    checksum: [...new Set(runs.map((r) => r.checksum))],
    errors: runs.reduce((total, r) => total + r.errors, 0),
  };
}

function corpusStats(size) {
  const docs = corpusFor(size);
  const words = countIds(docs.map((d) => d.content.split(/\s+/)));
  return { size, words, avgWords: Math.round(words / size) };
}

function header(impls, sizes) {
  return {
    kind: "env",
    node: process.version,
    cpus: os.cpus().length,
    cpu: os.cpus()[0]?.model,
    loadavg: os.loadavg(),
    impls,
    corpora: sizes.map(corpusStats),
  };
}

// The checksums of one size and metric must agree across runs and
// implementations: the outputs did not change.
function footer(summaries) {
  const checksums = new Map();
  for (const { size, metric, checksum: sums } of summaries) {
    const key = `${size}/${metric}`;
    checksums.set(key, new Set([...(checksums.get(key) ?? []), ...sums]));
  }
  const checksumsAgree = [...checksums.values()].every(
    (sums) => sums.size === 1
  );
  const errors = summaries.reduce((total, s) => total + s.errors, 0);
  return { kind: "end", checksumsAgree, errors, loadavg: os.loadavg() };
}

function plan(values) {
  const impls =
    values.impl === "both" ? ["current", "reference"] : [values.impl];
  const sizes = values.sizes.split(",").map(Number);
  const metrics = values.metrics.split(",");
  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1) {
    console.error(`--runs must be a positive integer, not "${values.runs}".`);
    process.exit(1);
  }
  return { impls, sizes, metrics, runs };
}

function parent(values) {
  const { impls, sizes, metrics, runs } = plan(values);
  console.log(JSON.stringify(header(impls, sizes)));
  const results = new Map();
  for (let run = 0; run < runs; run++) {
    const order = run % 2 ? [...impls].reverse() : impls;
    for (const size of sizes) {
      for (const metric of metrics) {
        for (const impl of order) {
          const key = JSON.stringify({ impl, size, metric });
          const result = measure({ impl, metric, size: String(size) });
          console.log(
            JSON.stringify({ kind: "run", run, impl, size, metric, ...result })
          );
          results.set(key, [...(results.get(key) ?? []), result]);
        }
      }
    }
  }
  const summaries = [...results].map(([key, list]) =>
    summarize(JSON.parse(key), list)
  );
  for (const summary of summaries) console.log(JSON.stringify(summary));
  console.log(JSON.stringify(footer(summaries)));
}

const { values } = parseArgs({
  options: {
    child: { type: "boolean", default: false },
    impl: { type: "string", default: "current" },
    metric: { type: "string", default: "allPairs" },
    metrics: { type: "string", default: Object.keys(METRICS).join(",") },
    sizes: { type: "string", default: "200,1005" },
    runs: { type: "string", default: "5" },
  },
});

if (values.child) {
  await child({ ...values, size: Number(values.sizes) });
} else {
  parent(values);
}
