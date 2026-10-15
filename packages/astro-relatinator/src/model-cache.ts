import type { RelatinatorModel } from "relatinator";

interface CachedModel {
  readonly fingerprint: string;
  readonly model: RelatinatorModel;
}

const cache = new Map<string, CachedModel>();

/**
 * Returns the model stored under `key` while its fingerprint matches.
 * Otherwise builds a new model and replaces the entry, so the cache
 * holds at most one model per key.
 */
export function getCachedModel(
  key: string,
  fingerprint: string,
  build: () => RelatinatorModel
): RelatinatorModel {
  const cached = cache.get(key);
  if (cached?.fingerprint === fingerprint) return cached.model;
  const model = build();
  cache.set(key, { fingerprint, model });
  return model;
}
