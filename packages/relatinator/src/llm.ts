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
 * The part of `fetch` that the chat requests use.
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
 * An OpenAI-compatible chat endpoint: a local server or a hosted API.
 * @experimental
 */
export interface ChatEndpoint {
  /** The base URL with the version path, for example `http://127.0.0.1:8080/v1`. */
  baseURL: string;
  model: string;
  /** Sent as `Authorization: Bearer <apiKey>`. */
  apiKey?: string;
  /** More request headers, for example a session header that a provider needs. */
  headers?: Record<string, string>;
  /** More fields for the request body, for example `chat_template_kwargs`. */
  body?: Record<string, unknown>;
  /** A replacement for the global `fetch`. */
  fetch?: FetchLike;
}

/**
 * Scores each topic for a text. The score is the log-odds of "yes" over "no":
 * 0 means even, a positive score means the topic applies.
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

async function chat(
  endpoint: ChatEndpoint,
  messages: ChatMessage[],
  fields: Record<string, unknown>
): Promise<ChatResponse> {
  const {
    baseURL,
    model,
    apiKey,
    headers,
    body,
    fetch: run = (globalThis as unknown as { fetch: FetchLike }).fetch,
  } = endpoint;
  const response = await run(`${baseURL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      ...headers,
    },
    body: JSON.stringify({ model, messages, ...fields, ...body }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Chat request failed: ${response.status} ${detail}`);
  }
  return (await response.json()) as ChatResponse;
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
  endpoint: ChatEndpoint,
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
    const post = text.slice(0, maxChars);
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
  endpoint: ChatEndpoint,
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
        content: `Topics:\n${list}\n\nPost:\n${text.slice(0, maxChars)}`,
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
  endpoint: ChatEndpoint
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
