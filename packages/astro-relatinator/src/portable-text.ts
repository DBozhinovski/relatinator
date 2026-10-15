interface PortableTextBlock {
  readonly _type?: unknown;
  readonly children?: unknown;
}

function blockText({ _type, children }: PortableTextBlock): string | undefined {
  if (_type !== "block" || !Array.isArray(children)) return undefined;
  return children
    .map((span: { text?: unknown }) =>
      typeof span?.text === "string" ? span.text : ""
    )
    .join("");
}

/**
 * Converts Portable Text to plain text: the span text of each `block`,
 * one block per line. Other block types are skipped. A string is
 * returned as it is.
 */
export function portableTextToPlainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((block: PortableTextBlock) => blockText(block ?? {}))
    .filter((text) => text !== undefined)
    .join("\n");
}

/** The plain text of a Portable Text value, or `undefined` for other values. */
export function portableTextValue(value: unknown): string | undefined {
  const isPortableText =
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item?._type === "string");
  return isPortableText ? portableTextToPlainText(value) : undefined;
}
