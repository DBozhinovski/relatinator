// Scores classify() or classifyWithLLM() against labels that a person approved.
// Run `pnpm run build` first. See "LLM topics" in docs/architecture.md.
//
// node eval/classify.mjs --posts posts.json --labels labels.json --topics topics.json \
//   [--judge bm25|logprob|json] [--base-url URL] [--model NAME] [--api-key-env VAR] \
//   [--body JSON] [--headers JSON] [--cache DIR] [--limit 2] [--min-score 0]
//
// posts.json: [{ id, title, description, body }]
// labels.json: { posts: { [id]: [tag, ...] } }
// topics.json: [{ tag, description }]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { classify } from "../dist/index.js";
import { jsonJudge, logprobJudge } from "../dist/llm.js";

const { values: args } = parseArgs({
  options: {
    posts: { type: "string" },
    labels: { type: "string" },
    topics: { type: "string" },
    judge: { type: "string", default: "logprob" },
    "base-url": { type: "string", default: "http://127.0.0.1:8080/v1" },
    model: { type: "string", default: "" },
    "api-key-env": { type: "string" },
    body: { type: "string", default: "{}" },
    headers: { type: "string", default: "{}" },
    cache: { type: "string" },
    limit: { type: "string", default: "2" },
    "min-score": { type: "string", default: "0" },
  },
});

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const posts = readJson(args.posts);
const labels = readJson(args.labels).posts;
const topics = readJson(args.topics);
const limit = Number(args.limit);
const textOf = (post) => [post.title, post.description, post.body].join("\n\n");

function makeJudge() {
  const endpoint = {
    baseURL: args["base-url"],
    model: args.model,
    apiKey: args["api-key-env"] ? process.env[args["api-key-env"]] : undefined,
    body: JSON.parse(args.body),
    headers: JSON.parse(args.headers),
  };
  if (args.judge === "json") return jsonJudge(endpoint);
  if (args.judge === "logprob") return logprobJudge(endpoint);
  throw new Error(`Unknown judge: ${args.judge}`);
}

// Returns the score of each topic for each post. A cache keeps the scores of each post.
async function scorePosts() {
  if (args.judge === "bm25") {
    return posts.map((post) => {
      const scored = classify(topics, textOf(post), {
        ratio: 0,
        limit: Infinity,
      });
      return topics.map(
        ({ tag }) => scored.find((s) => s.tag === tag)?.score ?? 0
      );
    });
  }
  const judge = makeJudge();
  if (args.cache) mkdirSync(args.cache, { recursive: true });
  const all = [];
  for (const post of posts) {
    const file = args.cache && join(args.cache, `${post.id}.json`);
    if (file && existsSync(file)) {
      all.push(readJson(file));
      continue;
    }
    const scores = await judge(textOf(post), topics);
    if (file) writeFileSync(file, JSON.stringify(scores));
    all.push(scores);
  }
  return all;
}

// Precision, recall, and F1 of the topics with a score of `cut` or more, at most `limit` for each post.
function measure(table, cut) {
  let predicted = 0;
  let correct = 0;
  let gold = 0;
  posts.forEach((post, i) => {
    const picked = topics
      .map(({ tag }, j) => ({ tag, score: table[i][j] }))
      .filter(({ score }) => score >= cut)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    gold += labels[post.id].length;
    predicted += picked.length;
    correct += picked.filter(({ tag }) => labels[post.id].includes(tag)).length;
  });
  const precision = predicted ? correct / predicted : 0;
  const recall = correct / gold;
  const f1 =
    precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1, predicted };
}

// The chance that a labeled pair of post and topic scores above an unlabeled pair.
function auc(table) {
  const positive = [];
  const negative = [];
  posts.forEach((post, i) =>
    topics.forEach(({ tag }, j) =>
      (labels[post.id].includes(tag) ? positive : negative).push(table[i][j])
    )
  );
  let wins = 0;
  for (const p of positive) {
    for (const n of negative) wins += p > n ? 1 : p === n ? 0.5 : 0;
  }
  return wins / (positive.length * negative.length);
}

const show = (name, { precision, recall, f1, predicted }) =>
  console.log(
    `${name.padEnd(28)} P ${precision.toFixed(2)} R ${recall.toFixed(2)} F1 ${f1.toFixed(2)} predicted ${predicted}`
  );

const started = Date.now();
const table = await scorePosts();
const cut = args.judge === "bm25" ? 0.5 : Number(args["min-score"]);
console.log(
  `${args.judge} ${args.model} on ${args.topics}: ${((Date.now() - started) / 1000).toFixed(0)} s`
);
show(`score >= ${cut}, limit ${limit}`, measure(table, cut));
const best = [...new Set(table.flat())]
  .map((value) => ({ value, ...measure(table, value) }))
  .reduce((a, b) => (b.f1 > a.f1 ? b : a));
show(`best cut ${best.value.toFixed(2)}, limit ${limit}`, best);
console.log(`AUC ${auc(table).toFixed(2)}`);
