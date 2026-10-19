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

interface StubLiveEntry {
  id: string;
  data: Record<string, unknown>;
  rendered?: { html: string };
}

const liveCollections = new Map<string, StubLiveEntry[] | Error>();

/** Sets the entries of a live collection, or the error that it returns. */
export function setLiveCollection<E extends StubLiveEntry>(
  collection: string,
  entries: readonly E[] | Error
): E[] {
  const stored = entries instanceof Error ? entries : [...entries];
  liveCollections.set(collection, stored);
  return stored instanceof Error ? [] : stored;
}

/** As in Astro, an unknown collection gives an error, not an empty list. */
export async function getLiveCollection(
  collection: string
): Promise<{ entries?: StubLiveEntry[]; error?: Error }> {
  const stored =
    liveCollections.get(collection) ??
    new Error(`Collection "${collection}" is not a live collection.`);
  return stored instanceof Error ? { error: stored } : { entries: stored };
}
