interface StubEntry {
  id: string;
  collection: string;
  data: Record<string, unknown>;
  body?: string;
  digest?: string;
}

const collections = new Map<string, StubEntry[]>();

export function setCollection(
  collection: string,
  entries: readonly Omit<StubEntry, "collection">[]
): StubEntry[] {
  const stored = entries.map((entry) => ({ ...entry, collection }));
  collections.set(collection, stored);
  return stored;
}

export async function getCollection(collection: string): Promise<StubEntry[]> {
  return collections.get(collection) ?? [];
}
