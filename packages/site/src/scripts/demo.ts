import { classify, createModel } from "relatinator";
import type { RelatinatorModel } from "relatinator";
import { relatedRows, topicRows } from "../lib/demo/lists";
import { parseTopics } from "../lib/demo/topics";
import { termRows } from "../lib/demo/terms";

type Post = { id: string; title: string; content: string };

function controlOf(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Missing demo control: ${id}`);
  return element;
}

function readPosts(): Post[] {
  const json = document.getElementById("demo-corpus")?.dataset.posts;
  if (typeof json !== "string") return [];
  return JSON.parse(json) as Post[];
}

function titleOf(titles: Map<string, string>, id: string): string {
  const title = titles.get(id);
  if (title === undefined) return id;
  return title;
}

// An empty result list says so instead of going blank.
function renderEmpty(list: HTMLOListElement, text: string): void {
  const item = document.createElement("li");
  item.className = "demo-empty";
  item.textContent = text;
  list.replaceChildren(item);
}

function renderText(row: { id: string; label: string; score: string }, isTop: boolean, rank?: number): HTMLElement {
  const item = document.createElement("li");
  if (isTop) item.className = "top";
  if (rank !== undefined) item.classList.add("demo-related");
  if (rank !== undefined) {
    const rankLabel = document.createElement("span");
    rankLabel.className = "demo-rank";
    rankLabel.textContent = `0${rank + 1}`;
    item.appendChild(rankLabel);
  }
  const label = document.createElement("span");
  label.className = "demo-title";
  label.textContent = row.label;
  const score = document.createElement("span");
  score.className = "demo-score";
  score.textContent = row.score;
  item.append(label, score);
  return item;
}

// Shared terms appear inside the result only while the Why button is open.
function toggleTerms(
  item: HTMLElement,
  button: HTMLButtonElement,
  rowId: string,
  select: HTMLSelectElement,
  model: RelatinatorModel,
): void {
  const open = button.getAttribute("aria-expanded") === "true";
  if (open) {
    button.setAttribute("aria-expanded", "false");
    item.querySelector("ul")?.remove();
    return;
  }
  button.setAttribute("aria-expanded", "true");
  const terms = document.createElement("ul");
  terms.setAttribute("aria-label", "Shared terms");
  for (const row of termRows(model.explainRelated(select.value, rowId))) {
    const term = document.createElement("li");
    const code = document.createElement("code");
    code.textContent = row.term;
    const score = document.createElement("span");
    score.className = "demo-score";
    score.textContent = row.score;
    term.append(code, score);
    terms.appendChild(term);
  }
  item.appendChild(terms);
}

// Any text in the query field switches the list to a text search.
function readQuery(): string {
  const query = controlOf("demo-query") as HTMLTextAreaElement;
  return query.value;
}

function renderRelatedItem(
  row: { id: string; label: string; score: string },
  isTop: boolean,
  rank: number,
  select: HTMLSelectElement,
  model: RelatinatorModel,
  withWhy: boolean,
): HTMLElement {
  const item = renderText(row, isTop, rank);
  if (!withWhy) return item;
  const why = document.createElement("button");
  why.className = "btn-secondary";
  why.textContent = "Why";
  why.setAttribute("aria-expanded", "false");
  why.addEventListener("click", () => toggleTerms(item, why, row.id, select, model));
  const score = item.querySelector(".demo-score");
  item.insertBefore(why, score);
  return item;
}

function renderRelated(
  select: HTMLSelectElement,
  list: HTMLOListElement,
  model: RelatinatorModel,
  titles: Map<string, string>,
): void {
  const query = readQuery();
  const useText = query.length > 0;
  select.disabled = useText;
  const scored = useText ? model.findRelatedToTextScored(query) : model.findRelatedScored(select.value);
  const rows = relatedRows(scored, (id) => titleOf(titles, id));
  if (rows.length === 0) {
    renderEmpty(list, "No related posts");
    return;
  }
  list.replaceChildren();
  for (let index = 0; index < rows.length; index += 1) {
    list.appendChild(renderRelatedItem(rows[index], index === 0, index, select, model, !useText));
  }
}

// Control events repaint the result lists, so the page reacts to what the
// visitor sets without any timer.
function watchControl(element: HTMLElement, handler: () => void): void {
  element.addEventListener("input", handler);
  element.addEventListener("change", handler);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Topic rows repaint from the topics field, the text field, and the ratio.
function renderTopics(list: HTMLOListElement, alert: HTMLElement): void {
  const range = controlOf("demo-ratio") as HTMLInputElement;
  controlOf("demo-ratio-value").textContent = range.value;
  const topics = parseTopics((controlOf("demo-topics") as HTMLTextAreaElement).value);
  const text = (controlOf("demo-text") as HTMLTextAreaElement).value;
  try {
    const rows = topicRows(classify(topics, text, { ratio: range.valueAsNumber }));
    alert.textContent = "";
    if (rows.length === 0) {
      renderEmpty(list, "No topics match");
      return;
    }
    list.replaceChildren();
    for (let index = 0; index < rows.length; index += 1) {
      list.appendChild(renderText(rows[index], index === 0));
    }
  } catch (error) {
    alert.textContent = messageOf(error);
  }
}

// The checked radio decides which scoring model paints the list.
function methodOf(): "bm25" | "tfidf" {
  const tfidf = controlOf("demo-method-tfidf") as HTMLInputElement;
  if (tfidf.checked) return "tfidf";
  return "bm25";
}

function wireDemo(): void {
  const posts = readPosts();
  const titles = new Map(posts.map((post) => [post.id, post.title]));
  const models = {
    bm25: createModel(posts, { method: "bm25" }),
    tfidf: createModel(posts, { method: "tfidf" }),
  };
  const select = controlOf("demo-post") as HTMLSelectElement;
  const relatedList = controlOf("demo-related") as HTMLOListElement;
  const topicList = controlOf("demo-topic-results") as HTMLOListElement;
  const alert = controlOf("demo-alert");
  const paintRelated = () => renderRelated(select, relatedList, methodOf() === "tfidf" ? models.tfidf : models.bm25, titles);
  const paintTopics = () => renderTopics(topicList, alert);
  const paint = () => {
    paintRelated();
    paintTopics();
  };
  const controls = [
    select,
    controlOf("demo-method-bm25"),
    controlOf("demo-method-tfidf"),
    controlOf("demo-query"),
    controlOf("demo-topics"),
    controlOf("demo-text"),
    controlOf("demo-ratio"),
  ];
  for (const control of controls) watchControl(control, paint);
  paint();
}

wireDemo();
