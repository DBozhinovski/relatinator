// One topic per line: "tag: description". A line without a colon is a bare tag.
export function parseTopics(text: string): { tag: string; description?: string }[] {
  const topics: { tag: string; description?: string }[] = [];
  for (const line of text.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) {
      const tag = line.trim();
      if (tag.length > 0) topics.push({ tag });
      continue;
    }
    topics.push({ tag: line.slice(0, colon).trim(), description: line.slice(colon + 1).trim() });
  }
  return topics;
}
