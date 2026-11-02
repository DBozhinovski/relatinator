import { describe, expect, it } from "vitest";
import {
  classifyWithLLM,
  describeTopics,
  jsonJudge,
  logprobJudge,
  type ChatEndpoint,
  type TopicJudge,
} from "../src/llm.js";

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: {
    model: string;
    messages: { role: string; content: string }[];
    [field: string]: unknown;
  };
}

function fakeEndpoint(reply: (sent: Sent) => unknown, status = 200) {
  const sent: Sent[] = [];
  const endpoint: ChatEndpoint = {
    baseURL: "http://model.test/v1/",
    model: "small",
    fetch: async (url, init) => {
      const request = {
        url: String(url),
        headers: init.headers,
        body: JSON.parse(init.body),
      };
      sent.push(request);
      return new Response(JSON.stringify(reply(request)), { status });
    },
  };
  return { endpoint, sent };
}

function letters(a: number, b: number) {
  return {
    choices: [
      {
        logprobs: {
          content: [
            {
              top_logprobs: [
                { token: "A", logprob: a },
                { token: " B", logprob: b },
              ],
            },
          ],
        },
      },
    ],
  };
}

function content(text: string) {
  return { choices: [{ message: { content: text } }] };
}

const topics = [
  { tag: "community", description: "meetups, BeerJS" },
  { tag: "astro" },
];

describe("logprobJudge", () => {
  it("averages the yes-minus-no margin over both letter orders", async () => {
    // The first question has "A. yes", the second "A. no".
    const answers = [letters(-0.1, -4.1), letters(-6.1, -0.1)];
    const { endpoint, sent } = fakeEndpoint(() => answers[sent.length - 1]);
    const scores = await logprobJudge(endpoint)("Notes from a meetup", [
      topics[0],
    ]);
    expect(scores).toEqual([5]);
    expect(sent.map((s) => s.body.messages[1].content)).toEqual([
      expect.stringContaining("Topic: community (meetups, BeerJS)\n"),
      expect.stringContaining("A. no\nB. yes"),
    ]);
    expect(sent[0].body.messages[1].content).toContain("A. yes\nB. no");
    expect(sent[0].url).toBe("http://model.test/v1/chat/completions");
    expect(sent[0].body).toMatchObject({
      model: "small",
      max_tokens: 1,
      temperature: 0,
      logprobs: true,
      top_logprobs: 20,
    });
  });

  it("gives a letter outside the top logprobs the floor of -30", async () => {
    const reply = {
      choices: [
        {
          logprobs: {
            content: [{ top_logprobs: [{ token: "A", logprob: 0 }] }],
          },
        },
      ],
    };
    const { endpoint } = fakeEndpoint(() => reply);
    // Order 1: yes 0, no -30. Order 2: no 0, yes -30.
    expect(await logprobJudge(endpoint)("text", [topics[1]])).toEqual([0]);
  });

  it("cuts the text at maxChars", async () => {
    const { endpoint, sent } = fakeEndpoint(() => letters(0, -1));
    await logprobJudge(endpoint, { maxChars: 4 })("abcdefgh", [topics[1]]);
    expect(sent[0].body.messages[1].content).toMatch(/^Post:\nabcd\n\n/);
  });

  it("throws when the response has no logprobs", async () => {
    const { endpoint } = fakeEndpoint(() => content("A"));
    await expect(logprobJudge(endpoint)("text", [topics[1]])).rejects.toThrow(
      "no top_logprobs"
    );
  });
});

describe("chat requests", () => {
  it("sends the key, the extra headers, and the extra body fields", async () => {
    const { endpoint, sent } = fakeEndpoint(() => letters(0, -1));
    await logprobJudge({
      ...endpoint,
      apiKey: "secret",
      headers: { "x-session": "1" },
      body: { chat_template_kwargs: { enable_thinking: false } },
    })("text", [topics[1]]);
    expect(sent[0].headers).toMatchObject({
      authorization: "Bearer secret",
      "x-session": "1",
    });
    expect(sent[0].body.chat_template_kwargs).toEqual({
      enable_thinking: false,
    });
  });

  it("throws an error with the status for a failed request", async () => {
    const { endpoint } = fakeEndpoint(() => ({ error: "expired" }), 401);
    await expect(jsonJudge(endpoint)("text", topics)).rejects.toThrow(
      'Chat request failed: 401 {"error":"expired"}'
    );
  });
});

describe("jsonJudge", () => {
  it("turns each probability into log-odds, from -30 to 30", async () => {
    const { endpoint, sent } = fakeEndpoint(() =>
      content('Here: {"community": 0.5, "astro": 1}')
    );
    expect(await jsonJudge(endpoint)("text", topics)).toEqual([0, 30]);
    expect(sent[0].body.messages[1].content).toContain(
      "- community: meetups, BeerJS\n- astro\n"
    );
  });

  it("scores a missing or invalid probability at -30", async () => {
    const { endpoint } = fakeEndpoint(() => content('{"community": "high"}'));
    expect(await jsonJudge(endpoint)("text", topics)).toEqual([-30, -30]);
  });

  it("asks again when a reply has no JSON object", async () => {
    const replies = [content(""), content('{"community": 1, "astro": 0}')];
    const { endpoint, sent } = fakeEndpoint(() => replies[sent.length - 1]);
    expect(await jsonJudge(endpoint)("text", topics)).toEqual([30, -30]);
    expect(sent).toHaveLength(2);
  });

  it("throws after `attempts` replies without a JSON object", async () => {
    const { endpoint, sent } = fakeEndpoint(() => content("community"));
    await expect(jsonJudge(endpoint)("text", topics)).rejects.toThrow(
      "did not reply with a JSON object"
    );
    expect(sent).toHaveLength(3);
    await expect(
      jsonJudge(endpoint, { attempts: 1 })("text", topics)
    ).rejects.toThrow("did not reply with a JSON object");
    expect(sent).toHaveLength(4);
  });
});

describe("classifyWithLLM", () => {
  const judgeOf =
    (scores: number[]): TopicJudge =>
    async () =>
      scores;
  const three = [...topics, { tag: "career" }];

  it("keeps topics at minScore or more, best first, at most limit", async () => {
    const judge = judgeOf([1, 7, 3]);
    expect(await classifyWithLLM(three, "text", { judge })).toEqual([
      { tag: "astro", score: 7 },
      { tag: "career", score: 3 },
    ]);
    expect(
      await classifyWithLLM(three, "text", { judge, minScore: 3, limit: 3 })
    ).toEqual([
      { tag: "astro", score: 7 },
      { tag: "career", score: 3 },
    ]);
  });

  it("returns [] when no topic reaches minScore", async () => {
    const judge = judgeOf([-1, -5, -0.5]);
    expect(await classifyWithLLM(three, "text", { judge })).toEqual([]);
  });

  it("keeps tied topics in input order", async () => {
    const judge = judgeOf([2, 2, 2]);
    const tags = (await classifyWithLLM(three, "t", { judge })).map(
      (t) => t.tag
    );
    expect(tags).toEqual(["community", "astro"]);
  });

  it("does not call the judge for an empty list", async () => {
    const judge: TopicJudge = async () => {
      throw new Error("called");
    };
    expect(await classifyWithLLM([], "text", { judge })).toEqual([]);
  });

  it("throws for a duplicate tag and an invalid minScore", async () => {
    const judge = judgeOf([0, 0]);
    await expect(
      classifyWithLLM([{ tag: "a" }, { tag: "a" }], "t", { judge })
    ).rejects.toThrow('Duplicate topic tag: "a"');
    await expect(
      classifyWithLLM(topics, "t", { judge, minScore: Number.NaN })
    ).rejects.toThrow(RangeError);
  });
});

describe("describeTopics", () => {
  const posts = [
    { title: "BeerJS 12", summary: "A meetup" },
    { title: "Astro" },
  ];

  it("returns a topic for each tag with the model's description", async () => {
    const { endpoint, sent } = fakeEndpoint(() =>
      content('{"community": "BeerJS Skopje meetups", "astro": "Astro sites"}')
    );
    expect(
      await describeTopics(["community", "astro"], posts, endpoint)
    ).toEqual([
      { tag: "community", description: "BeerJS Skopje meetups" },
      { tag: "astro", description: "Astro sites" },
    ]);
    expect(sent[0].body.messages[0].content).toContain(
      "- BeerJS 12: A meetup\n- Astro: "
    );
  });

  it("throws an error that names the tags without a description", async () => {
    const { endpoint } = fakeEndpoint(() => content('{"community": "x"}'));
    await expect(
      describeTopics(["community", "astro"], posts, endpoint)
    ).rejects.toThrow("no description for: astro");
  });
});
