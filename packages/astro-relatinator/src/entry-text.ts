/** The parts of an Astro or EmDash entry that relatinator reads. */
export interface ContentEntry {
  readonly id: string;
  readonly data: object;
  readonly body?: string;
  readonly digest?: string | number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Returns the text of a value that needs special handling, such as
 * Portable Text, or `undefined` to read the value as plain data.
 */
type ValueText = (value: unknown) => string | undefined;

function collectText(
  value: unknown,
  out: string[],
  valueText?: ValueText
): string[] {
  const special = valueText?.(value);
  if (special !== undefined) {
    out.push(special);
  } else if (typeof value === "string" || typeof value === "number") {
    out.push(String(value));
  } else if (Array.isArray(value)) {
    for (const item of value) collectText(item, out, valueText);
  } else if (isPlainObject(value)) {
    for (const item of Object.values(value)) collectText(item, out, valueText);
  }
  return out;
}

/**
 * The string and number values of the data of an entry (restricted to
 * `fields` when given), followed by its body. `valueText` reads the
 * values that need special handling.
 */
export function entryTextWith(
  entry: ContentEntry,
  fields: readonly string[] | undefined,
  valueText?: ValueText
): string {
  const data = isPlainObject(entry.data) ? entry.data : {};
  const values = fields ? fields.map((field) => data[field]) : data;
  const parts = collectText(values, [], valueText);
  if (entry.body) parts.push(entry.body);
  return parts.join(" ");
}

/**
 * The default text of an Astro entry, which `getRelated()` reads without
 * `text`. `entryTextWith()` gives the rules.
 */
export function entryText(
  entry: ContentEntry,
  fields?: readonly string[]
): string {
  return entryTextWith(entry, fields);
}
