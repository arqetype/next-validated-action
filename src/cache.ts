import type { CacheStorage } from './types';

/**
 * Cache entry with expiration
 */
type CacheEntry<T> = {
  value: T;
  expiresAt?: number;
};

/**
 * In-memory cache storage implementation
 */
export class MemoryCacheStorage implements CacheStorage {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval?: NodeJS.Timeout;
  private cleanupIntervalMs: number;

  constructor(cleanupIntervalMs = 60000) {
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.startCleanup();
  }

  /**
   * Get a value from the cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Set a value in the cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const entry: CacheEntry<T> = {
      value,
      expiresAt: ttl ? Date.now() + ttl : undefined,
    };

    this.cache.set(key, entry as CacheEntry<unknown>);
  }

  /**
   * Delete a value from the cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Clear all values from the cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get the number of items in the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);

    // Don't prevent Node.js from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Remove expired entries from the cache
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    expired: number;
  } {
    const now = Date.now();
    let expired = 0;

    for (const entry of this.cache.values()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        expired++;
      }
    }

    return {
      size: this.cache.size,
      expired,
    };
  }
}

/**
 * Global memory cache instance
 */
let globalMemoryCache: MemoryCacheStorage | undefined;

/**
 * Get or create the global memory cache instance
 */
export function getGlobalMemoryCache(): MemoryCacheStorage {
  if (!globalMemoryCache) {
    globalMemoryCache = new MemoryCacheStorage();
  }
  return globalMemoryCache;
}

/**
 * Clear the global memory cache
 */
export function clearGlobalMemoryCache(): void {
  if (globalMemoryCache) {
    globalMemoryCache.stopCleanup();
    globalMemoryCache = undefined;
  }
}

/**
 * Generate a default cache key from input
 */
export function generateDefaultCacheKey(input: unknown): string {
  try {
    // Use JSON.stringify with sorted keys for consistent hashing
    const sortedInput = JSON.stringify(input, Object.keys(input ?? {}).sort());
    return `cache:${hashString(sortedInput)}`;
  } catch {
    // Fallback to simple string conversion if JSON.stringify fails
    return `cache:${String(input)}`;
  }
}

/**
 * Simple string hashing function
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
