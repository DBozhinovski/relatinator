import { entryText, type ContentEntry } from "./entry-text.js";
import { portableTextValue } from "./portable-text.js";

// Values that EmDash adds to `entry.data` next to the content fields
// (emdash 1.2.0: loader.ts INCLUDE_IN_DATA and `slug`, `seo`; query.ts
// hydrates `byline`, `bylines`, and `terms`).
const SYSTEM_KEYS = new Set([
  "id",
  "slug",
  "status",
  "authorId",
  "primaryBylineId",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "scheduledAt",
  "draftRevisionId",
  "liveRevisionId",
  "locale",
  "translationGroup",
  "byline",
  "bylines",
  "seo",
  "terms",
]);

function termLabels(terms: unknown): string[] {
  if (typeof terms !== "object" || terms === null) return [];
  return Object.values(terms)
    .flat()
    .map((term: { label?: unknown }) => term?.label)
    .filter((label) => typeof label === "string");
}

function contentData(data: object): Record<string, unknown> {
  const content = Object.fromEntries(
    Object.entries(data).filter(([key]) => !SYSTEM_KEYS.has(key))
  );
  return { ...content, terms: termLabels((data as { terms?: unknown }).terms) };
}

/**
 * Default text for an EmDash entry. Portable Text becomes plain text.
 * Without `fields`, it reads the content fields and the labels of the
 * taxonomy terms, but not the values that EmDash adds to every entry.
 */
export function emdashEntryText(
  entry: ContentEntry,
  fields?: readonly string[]
): string {
  const data = fields ? entry.data : contentData(entry.data);
  return entryText({ id: entry.id, data }, fields, portableTextValue);
}
