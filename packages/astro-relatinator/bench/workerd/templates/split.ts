// The split endpoint of the workerd benchmark. Copy it to
// src/pages/bench/split.ts in an EmDash blog site. It times the steps
// of a getEmDashRelated() call without a window, each closed by a timer
// tick so that the workerd clock includes its CPU time.
import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";
import { emdashEntryText } from "astro-relatinator/emdash";
import { createModel } from "relatinator";

export const prerender = false;

type Entry = { id: string; data: Record<string, unknown> };

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function readAll(): Promise<Entry[]> {
  const entries: Entry[] = [];
  let cursor: string | undefined;
  do {
    const page = await getEmDashCollection("posts", {
      status: "published",
      limit: 100,
      cursor,
    });
    if (page.error) throw page.error;
    entries.push(...(page.entries as Entry[]));
    cursor = page.nextCursor;
  } while (cursor);
  return entries;
}

export const GET: APIRoute = async () => {
  const ms: Record<string, number> = {};
  await tick();
  let last = Date.now();
  const lap = async (name: string) => {
    await tick();
    const now = Date.now();
    ms[name] = now - last;
    last = now;
  };
  await lap("tickOnly");
  const entries = await readAll();
  await lap("d1Read");
  const fingerprint = entries.flatMap((entry) => [
    entry.id,
    emdashEntryText(entry),
  ]);
  await lap("textFingerprint");
  const docs = entries.map((entry) => ({
    id: entry.id,
    content: emdashEntryText(entry),
  }));
  await lap("textDocs");
  const model = createModel(docs, { method: "bm25" });
  await lap("modelBuild");
  const top = model.findRelated(entries[0].id, { limit: 3 });
  await lap("findRelated");
  const timing = Object.entries(ms).map(([name, dur]) => `${name};dur=${dur}`);
  return Response.json(
    { ms, entries: entries.length, items: fingerprint.length, top },
    { headers: { "X-Bench-Timing": timing.join(", ") } }
  );
};
