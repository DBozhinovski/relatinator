/**
 * Topics with a language model.
 *
 * @experimental The API of `relatinator/llm` is not the final shape. It can
 * change in a minor release. Pin an exact version if you use it.
 * @packageDocumentation
 */
import { checkTopicTags } from "./classify.js";
import type { ScoredTopic, Topic } from "./index.js";

/**
 * The part of `fetch` that the requests use.
 * @experimental
 */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

/**
 * An OpenAI-compatible endpoint: a local server or a hosted API. The judges
 * send chat requests or embedding requests to it.
 * @experimental
 */
export interface Endpoint {
  /** The base URL with the version path, for example `http://127.0.0.1:8080/v1`. */
  baseURL: string;
  model: string;
  /** Sent as `Authorization: Bearer <apiKey>`. */
  apiKey?: string;
  /** More request headers, for example a session header that a provider needs. */
  headers?: Record<string, string>;
  /** More fields for the request body, for example `chat_template_kwargs` or `dimensions`. */
  body?: Record<string, unknown>;
  /** A replacement for the global `fetch`. */
  fetch?: FetchLike;
}

/**
 * The name of `Endpoint` in 3.4.0.
 * @deprecated Use `Endpoint`.
 * @experimental
 */
export type ChatEndpoint = Endpoint;

/**
 * Scores each topic for a text. 0 is the cut: a positive score means that the
 * topic applies. The chat judges give the log-odds of "yes" over "no".
 * `embedJudge` gives the cosine above the mean of the topics, minus its cut.
 * @experimental
 */
export type TopicJudge = (
  text: string,
  topics: readonly Topic[]
) => Promise<number[]>;

/** @experimental */
export interface JudgeOptions {
  /** The judge reads only the first `maxChars` characters of the text. */
  maxChars?: number;
}

/** @experimental */
export interface LLMClassifyOptions {
  judge: TopicJudge;
  /** Keep topics with a score of `minScore` or more. The default is 0. */
  minScore?: number;
  /** The default is 2. */
  limit?: number;
}

/** @experimental */
export interface DescribePost {
  title: string;
  summary?: string;
}

const SYSTEM =
  "You tag blog posts with topics. A topic applies when it is a main subject of the post, not a passing mention.";
const DEFAULT_MAX_CHARS = 40_000;
/** The score of a letter that is not in the top logprobs, and the score limit of the JSON judge. */
const FLOOR = -30;

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface TopLogprob {
  token: string;
  logprob: number;
}

interface ChatResponse {
  choices?: {
    message?: { content?: string | null };
    logprobs?: { content?: { top_logprobs?: TopLogprob[] }[] };
  }[];
}

async function request(
  endpoint: Endpoint,
  path: string,
  fields: Record<string, unknown>,
  kind: "Chat" | "Embedding"
): Promise<unknown> {
  const {
    baseURL,
    model,
    apiKey,
    headers,
    body,
    fetch: run = (globalThis as unknown as { fetch: FetchLike }).fetch,
  } = endpoint;
  const response = await run(`${baseURL.replace(/\/$/, "")}/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      ...headers,
    },
    body: JSON.stringify({ model, ...fields, ...body }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`${kind} request failed: ${response.status} ${detail}`);
  }
  return response.json();
}

async function chat(
  endpoint: Endpoint,
  messages: ChatMessage[],
  fields: Record<string, unknown>
): Promise<ChatResponse> {
  return (await request(
    endpoint,
    "chat/completions",
    { messages, ...fields },
    "Chat"
  )) as ChatResponse;
}

function letterLogprob(top: readonly TopLogprob[], letter: string): number {
  return Math.max(
    FLOOR,
    ...top.filter((t) => t.token.trim() === letter).map((t) => t.logprob)
  );
}

/**
 * Asks one yes/no question for each topic and reads the logprobs of the two
 * answer letters. Each question runs in both letter orders, and the score is
 * the mean of the two yes-minus-no margins. The endpoint must return
 * `top_logprobs`. Questions run one at a time, so the server can reuse the
 * cached prompt prefix.
 * @experimental
 */
export function logprobJudge(
  endpoint: Endpoint,
  { maxChars = DEFAULT_MAX_CHARS }: JudgeOptions = {}
): TopicJudge {
  async function margin(post: string, topic: Topic, yesFirst: boolean) {
    const options = yesFirst ? "A. yes\nB. no" : "A. no\nB. yes";
    const content =
      `Post:\n${post}\n\nTopic: ${topic.tag}${topic.description ? ` (${topic.description})` : ""}\n` +
      `Is this topic a main subject of the post?\n${options}\nAnswer with only the letter.`;
    const response = await chat(
      endpoint,
      [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
      { max_tokens: 1, temperature: 0, logprobs: true, top_logprobs: 20 }
    );
    const top = response.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs;
    if (!top) throw new Error("The chat response has no top_logprobs.");
    const a = letterLogprob(top, "A");
    const b = letterLogprob(top, "B");
    return yesFirst ? a - b : b - a;
  }

  return async (text, topics) => {
    const post = head(text, maxChars);
    const scores: number[] = [];
    for (const topic of topics) {
      const first = await margin(post, topic, true);
      scores.push((first + (await margin(post, topic, false))) / 2);
    }
    return scores;
  };
}

function parseObject(content: string): Record<string, unknown> {
  const match = content.match(/\{[\s\S]*\}/);
  const parsed: unknown = match ? JSON.parse(match[0]) : null;
  if (!parsed || typeof parsed !== "object") {
    throw new Error(
      `The model did not reply with a JSON object: ${content.slice(0, 300)}`
    );
  }
  return parsed as Record<string, unknown>;
}

function logOdds(p: unknown): number {
  if (typeof p !== "number" || !(p >= 0 && p <= 1)) return FLOOR;
  const odds = Math.log(p) - Math.log(1 - p);
  return Math.min(-FLOOR, Math.max(FLOOR, odds));
}

/** @experimental */
export interface JsonJudgeOptions extends JudgeOptions {
  /** The number of requests for one text when a reply has no JSON object. The default is 3. */
  attempts?: number;
}

/**
 * Asks for a JSON object with a probability for each topic, in one request.
 * Use it when the endpoint gives no logprobs, for example a reasoning model.
 * The score is the log-odds of the probability, from -30 to 30. A reply
 * without a JSON object, for example an empty reply, causes a new request.
 * A failed request does not.
 * @experimental
 */
export function jsonJudge(
  endpoint: Endpoint,
  { maxChars = DEFAULT_MAX_CHARS, attempts = 3 }: JsonJudgeOptions = {}
): TopicJudge {
  const system =
    "You tag blog posts with topics from a fixed list. A topic applies when it is a main subject of the post, not a passing mention.\n" +
    "For every topic in the list, give the probability from 0 to 1 that it applies.\n" +
    "Reply with only a JSON object that maps every tag to its probability. Use no other keys.";
  return async (text, topics) => {
    const list = topics
      .map(
        ({ tag, description }) =>
          `- ${tag}${description ? `: ${description}` : ""}`
      )
      .join("\n");
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      {
        role: "user",
        content: `Topics:\n${list}\n\nPost:\n${head(text, maxChars)}`,
      },
    ];
    let error: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const response = await chat(endpoint, messages, {
        temperature: 0,
        max_tokens: 4000,
      });
      try {
        const probabilities = parseObject(
          response.choices?.[0]?.message?.content ?? ""
        );
        return topics.map(({ tag }) => logOdds(probabilities[tag]));
      } catch (cause) {
        error = cause;
      }
    }
    throw error;
  };
}

/** @experimental */
export interface EmbedJudgeOptions extends JudgeOptions {
  /** The amount by which a cosine must exceed the mean of the topics. The default is 0.04. */
  cut?: number;
  /** Makes the model input for a topic. The default is the EmbeddingGemma 2 search query. */
  topicInput?: (topic: Topic) => string;
  /** Makes the model input for the text. The default is the EmbeddingGemma 2 document format. */
  textInput?: (text: string) => string;
}

function unitVector(vector: unknown): number[] {
  const valid =
    Array.isArray(vector) &&
    vector.length > 0 &&
    vector.every((x) => typeof x === "number" && Number.isFinite(x));
  const length = valid ? Math.sqrt(vector.reduce((s, x) => s + x * x, 0)) : 0;
  if (!(length > 0)) {
    throw new Error("The embedding response has a vector that is not usable.");
  }
  return (vector as number[]).map((x) => x / length);
}

/** Puts each vector of the response at its `index`, or at its position when it has no index. */
function readVectors(response: unknown, count: number): number[][] {
  const data =
    response && typeof response === "object" && "data" in response
      ? response.data
      : undefined;
  const items: unknown[] = Array.isArray(data) ? data : [];
  if (items.length !== count) {
    throw new Error(
      `The embedding response has ${items.length} vectors for ${count} inputs.`
    );
  }
  // Each index is unique and from 0 to count - 1, so every input gets a vector.
  const vectors: number[][] = [];
  items.forEach((item, position) => {
    const fields = item && typeof item === "object" ? item : {};
    const index = "index" in fields ? fields.index : position;
    const usable =
      typeof index === "number" &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < count &&
      vectors[index] === undefined;
    if (!usable) {
      throw new Error(`The embedding response has a wrong index: ${index}.`);
    }
    vectors[index] = unitVector(
      "embedding" in fields ? fields.embedding : undefined
    );
  });
  return vectors;
}

async function embed(endpoint: Endpoint, input: string[]): Promise<number[][]> {
  const fields = { input, encoding_format: "float" };
  const response = await request(endpoint, "embeddings", fields, "Embedding");
  return readVectors(response, input.length);
}

function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `The embedding vectors have different lengths: ${a.length} and ${b.length}.`
    );
  }
  return a.reduce((sum, x, i) => sum + x * b[i], 0);
}

/** Cuts the text, but not between the two halves of a surrogate pair. */
function head(text: string, maxChars: number): string {
  const last = text.charCodeAt(maxChars - 1);
  return text.slice(
    0,
    last >= 0xd800 && last <= 0xdbff ? maxChars - 1 : maxChars
  );
}

/**
 * Embeds the text and each topic, and compares them by cosine. The score is
 * the cosine minus the mean cosine of all the topics, minus `cut`. Give it
 * the full topic list: with one topic, the score is always `-cut`. The judge
 * keeps the topic vectors, so each later text needs one request. It reads the
 * first `maxChars` characters of the text (default 2000). The default inputs
 * are the EmbeddingGemma 2 formats. Change them for other models.
 * @experimental
 */
export function embedJudge(
  endpoint: Endpoint,
  {
    maxChars = 2000,
    cut = 0.04,
    topicInput = ({ tag, description }) =>
      `task: search result | query: ${tag}${description ? `: ${description}` : ""}`,
    textInput = (text) => `title: none | text: ${text}`,
  }: EmbedJudgeOptions = {}
): TopicJudge {
  if (typeof cut !== "number" || !Number.isFinite(cut)) {
    throw new RangeError(`Invalid cut: ${cut}. Use a finite number.`);
  }
  const topicVectors = new Map<string, number[]>();
  return async (text, topics) => {
    const inputs = topics.map(topicInput);
    const missing = [...new Set(inputs)].filter((i) => !topicVectors.has(i));
    const [textVector, ...vectors] = await embed(endpoint, [
      textInput(head(text, maxChars)),
      ...missing,
    ]);
    missing.forEach((input, i) => topicVectors.set(input, vectors[i]));
    const cosines = inputs.map((input) =>
      cosine(topicVectors.get(input) as number[], textVector)
    );
    const mean = cosines.reduce((sum, c) => sum + c, 0) / cosines.length;
    return cosines.map((c) => c - mean - cut);
  };
}

/**
 * Chooses topics for a text with a language model. It returns the topics with
 * a score of `minScore` or more, best first, at most `limit` of them.
 * @experimental
 */
export async function classifyWithLLM(
  topics: readonly Topic[],
  text: string,
  { judge, minScore = 0, limit = 2 }: LLMClassifyOptions
): Promise<ScoredTopic[]> {
  if (typeof minScore !== "number" || Number.isNaN(minScore)) {
    throw new RangeError(`Invalid minScore: ${minScore}. Use a number.`);
  }
  checkTopicTags(topics);
  if (topics.length === 0) return [];
  const scores = await judge(text, topics);
  // The stable sort keeps tied topics in input order.
  return topics
    .map(({ tag }, i) => ({ tag, score: scores[i] }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Writes a description for each tag from the titles and summaries of the
 * posts. The descriptions name the projects, tools, and events of the posts.
 * @experimental
 */
export async function describeTopics(
  tags: readonly string[],
  posts: readonly DescribePost[],
  endpoint: Endpoint
): Promise<Topic[]> {
  const prompt =
    `These are the topic tags of a blog: ${tags.join(", ")}.\n` +
    "Write one description for each tag. A classifier reads a post and the descriptions, and decides which tags apply.\n" +
    "Each description is one short phrase of 15 words or fewer, a list of the subjects the tag covers.\n" +
    "Reply with only a JSON object that maps every tag to its description.\n" +
    "Name the specific projects, tools, events and themes that this blog writes about under each tag. Do not copy post titles.\n\n" +
    `The posts, as title and summary:\n${posts.map((p) => `- ${p.title}: ${p.summary ?? ""}`).join("\n")}`;
  const response = await chat(endpoint, [{ role: "user", content: prompt }], {
    max_tokens: 8000,
  });
  const descriptions = parseObject(
    response.choices?.[0]?.message?.content ?? ""
  );
  const missing = tags.filter((tag) => typeof descriptions[tag] !== "string");
  if (missing.length > 0) {
    throw new Error(`The model gave no description for: ${missing.join(", ")}`);
  }
  return tags.map((tag) => ({ tag, description: descriptions[tag] as string }));
}
