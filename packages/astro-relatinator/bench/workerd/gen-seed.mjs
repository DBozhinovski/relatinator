// Seed generator of the workerd benchmark. Usage:
//   node gen-seed.mjs <template-seed.json> <published-total> <out.json>
// Copies the seed of the EmDash blog template and adds generated posts
// until the seed has <published-total> published posts. The posts come
// from the corpus of the relatinator benchmark, with the same corpus
// options as bench/bench.mjs.
import fs from "node:fs";
import { generateCorpus } from "../../../relatinator/bench/corpus.js";

const TAGS = ["webdev", "opinion", "tools", "creativity"];
const CATEGORIES = ["development", "design", "notes"];

const span = (text, key) => ({ _type: "span", _key: key, text, marks: [] });

function block(paragraph, k) {
  const heading = paragraph.startsWith("## ");
  const words = (heading ? paragraph.slice(3) : paragraph).split(" ");
  const third = Math.ceil(words.length / 3);
  const parts = [0, 1, 2]
    .map((p) => words.slice(p * third, (p + 1) * third).join(" "))
    .filter(Boolean);
  return {
    _type: "block",
    _key: `b${k}`,
    style: heading ? "h2" : "normal",
    markDefs: [],
    children: (parts.length ? parts : [""]).map((text, p) =>
      span(p ? ` ${text}` : text, `s${k}.${p}`)
    ),
  };
}

function post(doc, i) {
  const words = doc.content.split(/\s+/).filter(Boolean);
  const tags = [TAGS[i % TAGS.length], TAGS[(i * 7 + 1) % TAGS.length]];
  return {
    id: `gen-${i}`,
    slug: `gen-${i}`,
    status: "published",
    data: {
      title: words.slice(0, 6).join(" ") || `Generated post ${i}`,
      excerpt: words.slice(6, 30).join(" "),
      content: doc.content.split("\n\n").map(block),
    },
    bylines: [{ byline: "byline-editorial" }],
    taxonomies: {
      category: [CATEGORIES[i % CATEGORIES.length]],
      tag: [...new Set(tags)],
    },
  };
}

const [template, total, out] = process.argv.slice(2);
const seed = JSON.parse(fs.readFileSync(template, "utf8"));
const published = () =>
  seed.content.posts.filter((p) => p.status === "published").length;
const extra = Number(total) - published();
const corpus =
  extra > 0
    ? generateCorpus(extra, { seed: 2026, minWords: 300, maxWords: 3000 })
    : [];
seed.content.posts.push(...corpus.map(post));
fs.writeFileSync(out, JSON.stringify(seed));
console.log(JSON.stringify({ out, published: published() }));
