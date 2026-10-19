// Stands in for `emdash` and `astro:content`. Each collection holds a
// fresh copy of its entries per request, as a database load would.
let collections = new Map();

export function setCollections(next) {
  collections = next;
}

export async function getEmDashCollection(type, { limit, cursor } = {}) {
  const entries = collections.get(type) ?? [];
  const start = Number(cursor ?? 0);
  const end = limit ? start + limit : entries.length;
  return {
    entries: entries.slice(start, end),
    nextCursor: end < entries.length ? String(end) : undefined,
  };
}

export function getRequestContext() {
  return undefined;
}

export async function getCollection(collection) {
  return collections.get(collection) ?? [];
}
