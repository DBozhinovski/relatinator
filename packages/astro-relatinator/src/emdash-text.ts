import { entryTextWith, type ContentEntry } from "./entry-text.js";
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
  const labels: string[] = [];
  const add = (term: { label?: unknown } | null | undefined) => {
    const label = term?.label;
    if (typeof label === "string") labels.push(label);
  };
  if (typeof terms !== "object" || terms === null) return labels;
  for (const group of Object.values(terms)) {
    // Like `flat()`: one level deep, without the holes.
    if (Array.isArray(group)) group.forEach(add);
    else add(group);
  }
  return labels;
}

function contentData(data: object): Record<string, unknown> {
  // No prototype, so a "__proto__" key is copied as data.
  const content: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(data)) {
    if (!SYSTEM_KEYS.has(key))
      content[key] = (data as Record<string, unknown>)[key];
  }
  content.terms = termLabels((data as { terms?: unknown }).terms);
  return content;
}

/**
 * The default text of an EmDash entry, which `getEmDashRelated()` reads
 * without `text`. Portable Text becomes plain text.
 * Without `fields`, it reads the content fields and the labels of the
 * taxonomy terms, but not the values that EmDash adds to every entry.
 */
export function emdashEntryText(
  entry: ContentEntry,
  fields?: readonly string[]
): string {
  const data = fields ? entry.data : contentData(entry.data);
  return entryTextWith({ id: entry.id, data }, fields, portableTextValue);
}
