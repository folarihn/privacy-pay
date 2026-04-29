import type { RiskCheckResult } from "./range-service";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  result: RiskCheckResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedResult(address: string): RiskCheckResult | null {
  const entry = cache.get(address);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(address);
    return null;
  }
  return entry.result;
}

export function setCachedResult(address: string, result: RiskCheckResult): void {
  cache.set(address, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}
