interface StubEntry {
  id: string;
  status?: "draft" | "published";
  data: Record<string, unknown>;
}

interface StubFilter {
  status?: string;
  limit?: number;
  cursor?: string;
}

const collections = new Map<string, StubEntry[]>();
const errors = new Map<string, Error>();

export function setEmDashCollection<E extends StubEntry>(
  type: string,
  entries: readonly E[]
): E[] {
  collections.set(type, [...entries]);
  errors.delete(type);
  return [...entries];
}

export function failEmDashCollection(type: string, error: Error): void {
  errors.set(type, error);
}

export async function getEmDashCollection(
  type: string,
  filter: StubFilter = {}
) {
  const error = errors.get(type);
  if (error) return { entries: [], error, cacheHint: {} };
  const status = filter.status ?? "published";
  const matching = (collections.get(type) ?? []).filter(
    (entry) => (entry.status ?? "published") === status
  );
  const start = Number(filter.cursor ?? 0);
  const end = filter.limit ? start + filter.limit : matching.length;
  const hasMore = end < matching.length;
  return {
    entries: matching.slice(start, end),
    cacheHint: {},
    nextCursor: hasMore ? String(end) : undefined,
    hasMore: filter.limit ? hasMore : undefined,
  };
}
