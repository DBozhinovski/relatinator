interface StubEntry {
  id: string;
  status?: "draft" | "published";
  /** The locale of the entry. An entry without one matches every locale. */
  locale?: string;
  data: Record<string, unknown>;
}

interface StubFilter {
  status?: string;
  limit?: number;
  cursor?: string;
  locale?: string;
}

const collections = new Map<string, StubEntry[]>();
const errors = new Map<string, Error>();

interface StubRequestContext {
  locale?: string;
  editMode?: boolean;
  preview?: { collection: string; id: string };
}

let requestContext: StubRequestContext | undefined;

/**
 * Sets the request context. As in EmDash, a query without `locale` uses
 * the locale of the context.
 */
export function setRequestContext(context?: StubRequestContext): void {
  requestContext = context;
}

export function getRequestContext() {
  return requestContext;
}

/** The arguments of each `getEmDashCollection()` call, in call order. */
export const emdashCalls: { type: string; filter: StubFilter }[] = [];

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
  emdashCalls.push({ type, filter });
  const error = errors.get(type);
  if (error) return { entries: [], error, cacheHint: {} };
  const status = filter.status ?? "published";
  const locale = filter.locale ?? requestContext?.locale;
  const matching = (collections.get(type) ?? []).filter(
    (entry) =>
      (entry.status ?? "published") === status &&
      (locale === undefined ||
        entry.locale === undefined ||
        entry.locale === locale)
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
