interface PortableTextBlock {
  readonly _type?: unknown;
  readonly children?: unknown;
}

function blockText({ _type, children }: PortableTextBlock): string | undefined {
  if (_type !== "block" || !Array.isArray(children)) return undefined;
  let text = "";
  for (const span of children) {
    if (typeof span?.text === "string") text += span.text;
  }
  return text;
}

/**
 * Converts Portable Text to plain text: the span text of each `block`,
 * one block per line. Other block types are skipped. A string is
 * returned as it is.
 */
export function portableTextToPlainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  let text: string | undefined;
  for (const block of value) {
    const line = blockText(block ?? {});
    if (line !== undefined)
      text = text === undefined ? line : `${text}\n${line}`;
  }
  return text ?? "";
}

/** The plain text of a Portable Text value, or `undefined` for other values. */
export function portableTextValue(value: unknown): string | undefined {
  const isPortableText =
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item?._type === "string");
  return isPortableText ? portableTextToPlainText(value) : undefined;
}
