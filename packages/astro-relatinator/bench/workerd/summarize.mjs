// Summary of the workerd benchmark. Usage:
//   node summarize.mjs results.json
// Each value is the median over the runs, with the range in brackets.
// A warm value of a run is the median of the warm requests of that run.
// Times are in ms. `cpu` is the CPU time of the workerd process.
import fs from "node:fs";

const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const stat = (values) =>
  `${Math.round(median(values))} [${Math.round(Math.min(...values))}-${Math.round(Math.max(...values))}]`;

const METRICS = {
  page: (r) => r.total,
  call: (r) => r.bench.related,
  cpu: (r) => r.cpu,
  dbCount: (r) => r.emdash["db.count"],
  dbTotal: (r) => r.emdash["db.total"],
};

function pageSummary(runs) {
  const summary = {};
  for (const [name, of] of Object.entries(METRICS)) {
    const cold = runs.map((r) => of(r.cold));
    if (cold.some((v) => v === undefined)) continue;
    summary[`cold ${name}`] = stat(cold);
    summary[`warm ${name}`] = stat(runs.map((r) => median(r.warm.map(of))));
  }
  return summary;
}

function splitSummary(runs) {
  const summary = {};
  for (const step of Object.keys(runs[0].cold.bench)) {
    summary[`cold ${step}`] = stat(runs.map((r) => r.cold.bench[step]));
    summary[`warm ${step}`] = stat(
      runs.map((r) => median(r.warm.map((w) => w.bench[step])))
    );
  }
  return summary;
}

const nodeSummary = (runs) => ({
  cold: stat(runs.map((r) => r.node.cold)),
  warm: stat(runs.map((r) => r.node.warm)),
});

const SUMMARIES = { split: splitSummary, node: nodeSummary };

const out = [];
for (const size of new Set(rows.map((r) => r.size))) {
  for (const variant of new Set(rows.map((r) => r.variant))) {
    const runs = rows.filter((r) => r.size === size && r.variant === variant);
    if (!runs.length) continue;
    out.push({
      size,
      variant,
      runs: runs.length,
      errors: runs.reduce((n, r) => n + r.errors, 0),
      load: stat(runs.map((r) => r.load)),
      ...(SUMMARIES[variant] ?? pageSummary)(runs),
    });
  }
}
console.log(JSON.stringify(out, null, 1));
