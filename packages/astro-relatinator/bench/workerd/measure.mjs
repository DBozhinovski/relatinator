// Measurement script of the workerd benchmark. Usage:
//   node measure.mjs --site <site> --states <dir> [--runs 5]
//     [--sizes 1005] [--variants related,window,baseline]
//     [--max-age 60] [--warm 10] [--port 4399] [--cpus 0-3]
//     [--out results.json]
// <dir> holds one seeded D1 state for each size, as state-<size>.
// For each run, size, and variant, the script copies the state into the
// site, starts `astro preview` (local workerd), sends one cold request
// and --warm warm requests, and stops the server. The variant order
// rotates in each run. Variants:
//   related   the post page, maxAge 0
//   window    the post page, maxAge --max-age
//   baseline  the post page without the call
//   split     the split endpoint
//   node      bench/bench.mjs in memory, with the dist of the site
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    site: { type: "string" },
    states: { type: "string" },
    runs: { type: "string", default: "5" },
    sizes: { type: "string", default: "1005" },
    variants: { type: "string", default: "related,window,baseline" },
    "max-age": { type: "string", default: "60" },
    warm: { type: "string", default: "10" },
    port: { type: "string", default: "4399" },
    cpus: { type: "string", default: "0-3" },
    out: { type: "string", default: "results.json" },
  },
});
const SITE = path.resolve(args.site);
const STATES = path.resolve(args.states);
const BASE = `http://localhost:${args.port}`;
const WARM = Number(args.warm);
const BENCH = new URL("../bench.mjs", import.meta.url).pathname;
const VARIANTS = {
  related: { path: (slug) => `/posts/${slug}`, items: 3 },
  window: {
    path: (slug) => `/posts/${slug}?maxAge=${args["max-age"]}`,
    items: 3,
  },
  baseline: { path: (slug) => `/posts/${slug}?related=0`, items: 0 },
  split: { path: () => "/bench/split", items: 0 },
};

// The 7 posts of the template, or generated posts at equal steps.
const TEMPLATE_SLUGS = [
  "building-for-the-long-term",
  "the-case-for-static",
  "learning-in-public",
  "small-tools-big-impact",
  "designing-with-constraints",
  "a-weekend-with-a-side-project",
  "notes-on-simplicity",
];
const slugsFor = (size) =>
  size <= TEMPLATE_SLUGS.length
    ? TEMPLATE_SLUGS
    : Array.from(
        { length: WARM + 1 },
        (_, k) =>
          `gen-${Math.floor((k * (size - TEMPLATE_SLUGS.length)) / (WARM + 1))}`
      );

const sh = (cmd) =>
  execSync(cmd, { cwd: SITE, stdio: ["ignore", "pipe", "pipe"] }).toString();
const load = () =>
  Number(fs.readFileSync("/proc/loadavg", "utf8").split(" ")[0]);
const workerdRunning = () => {
  try {
    return execFileSync("pgrep", [
      "-f",
      `${SITE}/node_modules/@cloudflare/workerd`,
    ])
      .toString()
      .trim()
      .split("\n")
      .map(Number);
  } catch {
    return [];
  }
};

/** User and system CPU time of a process, in ms (Linux, 100 ticks/s). */
function cpuMs(pid) {
  const fields = fs
    .readFileSync(`/proc/${pid}/stat`, "utf8")
    .split(") ")[1]
    .split(" ");
  return (Number(fields[11]) + Number(fields[12])) * 10;
}

/** The `name;dur=<ms>` items of a Server-Timing style header. */
const timing = (header) =>
  Object.fromEntries(
    (header ?? "")
      .split(",")
      .map((item) => item.trim().split(";"))
      .filter(([name]) => name)
      .map(([name, ...params]) => {
        const dur = params.find((p) => p.startsWith("dur="));
        return [name, dur ? Number(dur.slice(4)) : undefined];
      })
  );

async function request(url, pid) {
  const cpu0 = cpuMs(pid);
  const t0 = performance.now();
  const res = await fetch(BASE + url);
  const body = await res.text();
  const total = performance.now() - t0;
  const list = body.match(/<ul data-related[\s\S]*?<\/ul>/)?.[0] ?? "";
  return {
    url,
    status: res.status,
    total,
    cpu: cpuMs(pid) - cpu0,
    bench: timing(res.headers.get("x-bench-timing")),
    emdash: timing(res.headers.get("server-timing")),
    items: (list.match(/<li/g) ?? []).length,
  };
}

async function start() {
  execSync(
    `taskset -c ${args.cpus} npx astro preview --port ${args.port} > preview.log 2>&1`,
    {
      cwd: SITE,
    }
  );
  // A static asset does not run page code, so the isolate stays cold.
  const assets = fs.readdirSync(`${SITE}/dist/client/_astro`);
  const asset = assets.find(
    (file) => file.endsWith(".css") || file.endsWith(".js")
  );
  for (let i = 0; i < 300; i++) {
    const res = await fetch(`${BASE}/_astro/${asset}`).catch(() => undefined);
    await res?.arrayBuffer();
    if (res?.status === 200) return sleep(1000);
    if (res) throw new Error(`asset status ${res.status}`);
    await sleep(200);
  }
  throw new Error("the server did not start");
}

async function stop() {
  try {
    sh("npx astro preview stop");
  } catch {
    // The server was not running.
  }
  for (let i = 0; i < 50 && workerdRunning().length; i++) await sleep(100);
}

const wrong = (variant, response) =>
  response.status !== 200 ||
  response.items !== VARIANTS[variant].items ||
  (variant === "split" && response.bench.modelBuild === undefined);

async function measurePage(run, size, variant) {
  sh(`rm -rf .wrangler/state && cp -a ${STATES}/state-${size} .wrangler/state`);
  const row = { run, size, variant, load: load() };
  await start();
  const [pid] = workerdRunning();
  const slugs = slugsFor(size);
  const url = (k) => VARIANTS[variant].path(slugs[k % slugs.length]);
  row.cold = await request(url(0), pid);
  row.warm = [];
  for (let k = 1; k <= WARM; k++) row.warm.push(await request(url(k), pid));
  await stop();
  row.errors = [row.cold, ...row.warm].filter((r) => wrong(variant, r)).length;
  return row;
}

function measureNode(run, size) {
  const dist = `${SITE}/node_modules/astro-relatinator/dist`;
  const out = execFileSync("taskset", [
    "-c",
    args.cpus,
    process.execPath,
    "--expose-gc",
    BENCH,
    ...["--child", "emdash", "--size", String(size), "--dist", dist],
  ]);
  const node = JSON.parse(out.toString().trim().split("\n").at(-1));
  return {
    run,
    size,
    variant: "node",
    load: load(),
    node,
    errors: node.errors,
  };
}

const variants = args.variants.split(",");
const results = [];
await stop();
for (let run = 0; run < Number(args.runs); run++) {
  for (const size of args.sizes.split(",").map(Number)) {
    const shift = run % variants.length;
    for (const variant of [
      ...variants.slice(shift),
      ...variants.slice(0, shift),
    ]) {
      const row =
        variant === "node"
          ? measureNode(run, size)
          : await measurePage(run, size, variant);
      results.push(row);
      const warm = row.warm?.map((r) => Math.round(r.bench.related ?? r.total));
      console.log(
        JSON.stringify({ run, size, variant, errors: row.errors, warm })
      );
      fs.writeFileSync(args.out, JSON.stringify(results, null, 1));
    }
  }
}
