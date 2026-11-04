import { describe, expect, it } from "vitest";
import {
  classifyWithLLM,
  describeTopics,
  embedJudge,
  jsonJudge,
  logprobJudge,
  type Endpoint,
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
  const endpoint: Endpoint = {
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

  it("does not cut a surrogate pair in half", async () => {
    const { endpoint, sent } = fakeEndpoint(() => content('{"astro": 1}'));
    await jsonJudge(endpoint, { maxChars: 2 })("a\u{1F600}b", [topics[1]]);
    expect(sent[0].body.messages[1].content).toMatch(/Post:\na$/);
    const logprob = fakeEndpoint(() => letters(0, -1));
    await logprobJudge(logprob.endpoint, { maxChars: 2 })("a\u{1F600}", [
      topics[1],
    ]);
    expect(logprob.sent[0].body.messages[1].content).toContain("Post:\na\n\n");
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

describe("embedJudge", () => {
  const COMMUNITY = "task: search result | query: community: meetups, BeerJS";
  const ASTRO = "task: search result | query: astro";
  const three = [...topics, { tag: "career" }];
  const CAREER = "task: search result | query: career";
  // The server sends the vectors in reverse order, not unit length.
  function vectors(table: Record<string, number[]>) {
    return fakeEndpoint((sent) => ({
      data: (sent.body.input as string[])
        .map((input, index) => ({ index, embedding: table[input] }))
        .reverse(),
    }));
  }
  const table = {
    "title: none | text: Notes from a meetup": [3, 0],
    [COMMUNITY]: [2, 0],
    [ASTRO]: [0, 5],
    [CAREER]: [3, 4],
  };

  it("scores the cosine above the mean of the topics, minus the cut", async () => {
    const { endpoint, sent } = vectors(table);
    const scores = await embedJudge(endpoint)("Notes from a meetup", three);
    // Cosines 1, 0 and 0.6, so the mean is 0.533.
    expect(scores[0]).toBeCloseTo(1 - 1.6 / 3 - 0.04);
    expect(scores[1]).toBeCloseTo(0 - 1.6 / 3 - 0.04);
    expect(scores[2]).toBeCloseTo(0.6 - 1.6 / 3 - 0.04);
    expect(sent[0].url).toBe("http://model.test/v1/embeddings");
    expect(sent[0].body).toEqual({
      model: "small",
      input: [
        "title: none | text: Notes from a meetup",
        COMMUNITY,
        ASTRO,
        CAREER,
      ],
      encoding_format: "float",
    });
  });

  it("embeds each topic one time for all the texts", async () => {
    const { endpoint, sent } = vectors(table);
    const judge = embedJudge(endpoint, { cut: 0 });
    await judge("Notes from a meetup", three);
    const again = await judge("Notes from a meetup", [three[2], three[0]]);
    expect(sent[1].body.input).toEqual([
      "title: none | text: Notes from a meetup",
    ]);
    expect(again[0]).toBeCloseTo(-0.2);
    expect(again[1]).toBeCloseTo(0.2);
  });

  it("uses the given inputs, the key, and maxChars", async () => {
    const { endpoint, sent } = vectors({
      "doc: ab": [1, 0],
      "q: astro": [0, 1],
    });
    await embedJudge(
      { ...endpoint, apiKey: "secret", body: { dimensions: 256 } },
      {
        maxChars: 2,
        topicInput: (topic) => `q: ${topic.tag}`,
        textInput: (text) => `doc: ${text}`,
      }
    )("abc", [topics[1]]);
    expect(sent[0].headers.authorization).toBe("Bearer secret");
    expect(sent[0].body.input).toEqual(["doc: ab", "q: astro"]);
    expect(sent[0].body.dimensions).toBe(256);
  });

  it("does not cut a surrogate pair in half", async () => {
    const { endpoint, sent } = vectors({
      "title: none | text: a": [1, 0],
      [ASTRO]: [0, 1],
    });
    await embedJudge(endpoint, { maxChars: 2 })("a\u{1F600}b", [topics[1]]);
    expect(sent[0].body.input).toEqual(["title: none | text: a", ASTRO]);
  });

  it("throws for a failed request or a response that does not fit", async () => {
    const failed = fakeEndpoint(() => ({ error: "expired" }), 401);
    await expect(embedJudge(failed.endpoint)("t", topics)).rejects.toThrow(
      'Embedding request failed: 401 {"error":"expired"}'
    );
    const short = fakeEndpoint(() => ({
      data: [{ index: 0, embedding: [1] }],
    }));
    await expect(embedJudge(short.endpoint)("t", topics)).rejects.toThrow(
      "1 vectors for 3 inputs"
    );
    for (const embedding of [
      [0, 0],
      [1, Number.NaN],
      [1, Infinity],
      "1,0",
      [],
    ]) {
      const bad = fakeEndpoint(() => ({ data: [{ index: 0, embedding }] }));
      await expect(embedJudge(bad.endpoint)("t", [])).rejects.toThrow(
        "a vector that is not usable"
      );
    }
    const noData = fakeEndpoint(() => ({ data: "none" }));
    await expect(embedJudge(noData.endpoint)("t", [])).rejects.toThrow(
      "0 vectors for 1 inputs"
    );
  });

  it("throws for an index that repeats or is out of range", async () => {
    for (const indexes of [
      [0, 0],
      [0, 2],
      [-1, 0],
      [0, "1"],
    ]) {
      const { endpoint } = fakeEndpoint(() => ({
        data: indexes.map((index) => ({ index, embedding: [1, 0] })),
      }));
      await expect(embedJudge(endpoint)("t", [topics[1]])).rejects.toThrow(
        "a wrong index"
      );
    }
  });

  it("uses the position of a vector that has no index", async () => {
    const { endpoint } = fakeEndpoint(() => ({
      data: [
        { embedding: [1, 0] },
        { embedding: [1, 0] },
        { embedding: [0, 1] },
      ],
    }));
    const scores = await embedJudge(endpoint, { cut: 0 })("t", topics);
    expect(scores[0]).toBeCloseTo(0.5);
    expect(scores[1]).toBeCloseTo(-0.5);
  });

  it("throws for vectors of different lengths, also from the cache", async () => {
    const mixed = vectors({
      "title: none | text: t": [1, 0],
      [ASTRO]: [1, 0, 0],
    });
    await expect(embedJudge(mixed.endpoint)("t", [topics[1]])).rejects.toThrow(
      "different lengths: 3 and 2"
    );
    const replies = [
      {
        data: [
          { index: 0, embedding: [1, 0] },
          { index: 1, embedding: [0, 1] },
        ],
      },
      { data: [{ index: 0, embedding: [1, 0, 0] }] },
    ];
    let call = 0;
    const cached = fakeEndpoint(() => replies[call++]);
    const judge = embedJudge(cached.endpoint);
    await judge("t", [topics[1]]);
    await expect(judge("t", [topics[1]])).rejects.toThrow("different lengths");
  });

  it("gives -cut to a single topic", async () => {
    const { endpoint } = vectors(table);
    const [score] = await embedJudge(endpoint, { cut: 0.1 })(
      "Notes from a meetup",
      [topics[0]]
    );
    expect(score).toBeCloseTo(-0.1);
  });

  it("throws a RangeError for a cut that is not a finite number", () => {
    const { endpoint } = vectors(table);
    for (const cut of [Number.NaN, Infinity]) {
      expect(() => embedJudge(endpoint, { cut })).toThrow(RangeError);
    }
  });

  it("works with classifyWithLLM and its default minScore", async () => {
    const { endpoint } = vectors(table);
    const judge = embedJudge(endpoint);
    const result = await classifyWithLLM(three, "Notes from a meetup", {
      judge,
    });
    expect(result.map((t) => t.tag)).toEqual(["community", "career"]);
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
