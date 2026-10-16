import type { RelatinatorModel } from "relatinator";

interface CachedModel {
  readonly fingerprint: readonly string[];
  readonly model: RelatinatorModel;
}

const cache = new Map<string, CachedModel>();

function sameItems(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Returns the model stored under `key` while every item of its
 * fingerprint matches. Otherwise builds a new model and replaces the
 * entry, so the cache holds at most one model per key.
 */
export function getCachedModel(
  key: string,
  fingerprint: readonly string[],
  build: () => RelatinatorModel
): RelatinatorModel {
  const cached = cache.get(key);
  if (cached && sameItems(cached.fingerprint, fingerprint)) {
    return cached.model;
  }
  const model = build();
  cache.set(key, { fingerprint, model });
  return model;
}
