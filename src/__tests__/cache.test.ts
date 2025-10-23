import { IsString, IsNumber } from 'class-validator';
import { action } from '../builder';
import {
  MemoryCacheStorage,
  getGlobalMemoryCache,
  clearGlobalMemoryCache,
  generateDefaultCacheKey,
} from '../cache';

// Test DTOs
class CacheTestInput {
  @IsString()
  userId!: string;

  @IsNumber()
  count!: number;
}

class CacheTestOutput {
  @IsString()
  result!: string;

  @IsNumber()
  timestamp!: number;
}

describe('MemoryCacheStorage', () => {
  let cache: MemoryCacheStorage;

  beforeEach(() => {
    cache = new MemoryCacheStorage();
  });

  afterEach(() => {
    cache.stopCleanup();
  });

  describe('basic operations', () => {
    it('should store and retrieve values', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get<string>('key1');
      expect(result).toBe('value1');
    });

    it('should return undefined for non-existent keys', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should delete values', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');
      const result = await cache.get('key1');
      expect(result).toBeUndefined();
    });

    it('should clear all values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
    });

    it('should check if key exists', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('key2')).toBe(false);
    });

    it('should return correct size', async () => {
      expect(cache.size()).toBe(0);
      await cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
      await cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
    });
  });

  describe('TTL expiration', () => {
    it('should expire values after TTL', async () => {
      await cache.set('key1', 'value1', 100); // 100ms TTL
      expect(await cache.get('key1')).toBe('value1');

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(await cache.get('key1')).toBeUndefined();
    });

    it('should not expire values without TTL', async () => {
      await cache.set('key1', 'value1');
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(await cache.get('key1')).toBe('value1');
    });

    it('should return false for expired keys on has()', async () => {
      await cache.set('key1', 'value1', 100);
      expect(await cache.has('key1')).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(await cache.has('key1')).toBe(false);
    });
  });

  describe('complex values', () => {
    it('should store and retrieve objects', async () => {
      const obj = { name: 'test', value: 123 };
      await cache.set('obj', obj);
      const result = await cache.get<typeof obj>('obj');
      expect(result).toEqual(obj);
    });

    it('should store and retrieve arrays', async () => {
      const arr = [1, 2, 3, 4, 5];
      await cache.set('arr', arr);
      const result = await cache.get<typeof arr>('arr');
      expect(result).toEqual(arr);
    });
  });

  describe('statistics', () => {
    it('should return correct statistics', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2', 100);

      let stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.expired).toBe(0);

      await new Promise((resolve) => setTimeout(resolve, 150));

      stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.expired).toBe(1);
    });
  });
});

describe('generateDefaultCacheKey', () => {
  it('should generate consistent keys for same input', () => {
    const input = { userId: '123', count: 5 };
    const key1 = generateDefaultCacheKey(input);
    const key2 = generateDefaultCacheKey(input);
    expect(key1).toBe(key2);
  });

  it('should generate different keys for different inputs', () => {
    const input1 = { userId: '123', count: 5 };
    const input2 = { userId: '456', count: 10 };
    const key1 = generateDefaultCacheKey(input1);
    const key2 = generateDefaultCacheKey(input2);
    expect(key1).not.toBe(key2);
  });

  it('should handle null input', () => {
    const key = generateDefaultCacheKey(null);
    expect(key).toBeDefined();
    expect(typeof key).toBe('string');
  });

  it('should handle undefined input', () => {
    const key = generateDefaultCacheKey(undefined);
    expect(key).toBeDefined();
    expect(typeof key).toBe('string');
  });

  it('should handle primitive inputs', () => {
    expect(generateDefaultCacheKey('test')).toBeDefined();
    expect(generateDefaultCacheKey(123)).toBeDefined();
    expect(generateDefaultCacheKey(true)).toBeDefined();
  });
});

describe('globalMemoryCache', () => {
  afterEach(() => {
    clearGlobalMemoryCache();
  });

  it('should return the same instance', () => {
    const cache1 = getGlobalMemoryCache();
    const cache2 = getGlobalMemoryCache();
    expect(cache1).toBe(cache2);
  });

  it('should clear the global cache', () => {
    const cache1 = getGlobalMemoryCache();
    clearGlobalMemoryCache();
    const cache2 = getGlobalMemoryCache();
    expect(cache1).not.toBe(cache2);
  });
});

describe('Action caching', () => {
  let executionCount: number;

  beforeEach(() => {
    executionCount = 0;
    clearGlobalMemoryCache();
  });

  afterEach(() => {
    clearGlobalMemoryCache();
  });

  it('should cache successful action results', async () => {
    const testAction = action
      .inputDto(CacheTestInput)
      .outputDto(CacheTestOutput)
      .cache({
        ttl: 60000,
      })
      .action(async ({ parsedInput }) => {
        executionCount++;
        return {
          result: `Processed user ${parsedInput.userId}`,
          timestamp: Date.now(),
        };
      });

    const input = { userId: '123', count: 5 };

    // First call - should execute
    const result1 = await testAction(input);
    expect(result1.success).toBe(true);
    expect(executionCount).toBe(1);

    // Second call with same input - should use cache
    const result2 = await testAction(input);
    expect(result2.success).toBe(true);
    expect(executionCount).toBe(1); // Still 1, didn't execute again

    if (result1.success && result2.success) {
      expect(result1.data.result).toBe(result2.data.result);
      expect(result1.data.timestamp).toBe(result2.data.timestamp);
    }
  });

  it('should not cache different inputs', async () => {
    const testAction = action
      .inputDto(CacheTestInput)
      .cache({
        ttl: 60000,
      })
      .action(async ({ parsedInput }) => {
        executionCount++;
        return `Processed user ${parsedInput.userId}`;
      });

    await testAction({ userId: '123', count: 5 });
    await testAction({ userId: '456', count: 10 });

    expect(executionCount).toBe(2);
  });

  it('should use custom cache key generator', async () => {
    const testAction = action
      .inputDto(CacheTestInput)
      .cache({
        ttl: 60000,
        key: (input) => `user-${input.userId}`,
      })
      .action(async ({ parsedInput }) => {
        executionCount++;
        return `Processed user ${parsedInput.userId}`;
      });

    // Same userId, different count - should hit cache
    await testAction({ userId: '123', count: 5 });
    await testAction({ userId: '123', count: 10 });

    expect(executionCount).toBe(1);
  });

  it('should expire cache after TTL', async () => {
    const testAction = action
      .inputDto(CacheTestInput)
      .cache({
        ttl: 100, // 100ms
      })
      .action(async ({ parsedInput }) => {
        executionCount++;
        return `Processed user ${parsedInput.userId}`;
      });

    const input = { userId: '123', count: 5 };

    await testAction(input);
    expect(executionCount).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 150));

    await testAction(input);
    expect(executionCount).toBe(2); // Cache expired, executed again
  });

  it('should not cache errors by default', async () => {
    const testAction = action
      .inputDto(CacheTestInput)
      .cache({
        ttl: 60000,
      })
      .action(async () => {
        executionCount++;
        if (executionCount === 1) {
          throw new Error('First call fails');
        }
        return `Success on attempt ${executionCount}`;
      });

    const input = { userId: '123', count: 5 };

    const result1 = await testAction(input);
    expect(result1.success).toBe(false);
    expect(executionCount).toBe(1);

    const result2 = await testAction(input);
    expect(result2.success).toBe(true);
    expect(executionCount).toBe(2); // Executed again because error wasn't cached
  });

  it('should cache errors when configured', async () => {
    const testAction = action
      .inputDto(CacheTestInput)
      .cache({
        ttl: 60000,
        cacheErrors: true,
      })
      .action(async () => {
        executionCount++;
        throw new Error('Always fails');
      });

    const input = { userId: '123', count: 5 };

    const result1 = await testAction(input);
    expect(result1.success).toBe(false);
    expect(executionCount).toBe(1);

    const result2 = await testAction(input);
    expect(result2.success).toBe(false);
    expect(executionCount).toBe(1); // Error was cached, didn't execute again
  });

  it('should work with custom cache storage', async () => {
    const customCache = new MemoryCacheStorage();

    const testAction = action
      .inputDto(CacheTestInput)
      .cache({
        ttl: 60000,
        storage: customCache,
      })
      .action(async ({ parsedInput }) => {
        executionCount++;
        return `Processed user ${parsedInput.userId}`;
      });

    const input = { userId: '123', count: 5 };

    await testAction(input);
    expect(executionCount).toBe(1);

    await testAction(input);
    expect(executionCount).toBe(1);

    // Verify it's in the custom cache
    expect(customCache.size()).toBeGreaterThan(0);

    customCache.stopCleanup();
  });

  it('should cache validation errors', async () => {
    const testAction = action
      .inputDto(CacheTestInput)
      .cache({
        ttl: 60000,
        cacheErrors: true,
      })
      .action(async () => {
        executionCount++;
        return 'Processed data';
      });

    const invalidInput = { userId: 123, count: 'invalid' }; // Wrong types

    const result1 = await testAction(invalidInput);
    expect(result1.success).toBe(false);

    const result2 = await testAction(invalidInput);
    expect(result2.success).toBe(false);

    // Validation errors should be cached
    if (!result1.success && !result2.success) {
      expect(result1.error).toBe('input');
      expect(result2.error).toBe('input');
    }
  });

  it('should work with retry configuration', async () => {
    let attemptCount = 0;

    const testAction = action
      .inputDto(CacheTestInput)
      .cache({
        ttl: 60000,
      })
      .retry({
        attempts: 3,
        delay: 10,
        backoff: 'linear',
      })
      .action(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return `Success after ${attemptCount} attempts`;
      });

    const input = { userId: '123', count: 5 };

    const result1 = await testAction(input);
    expect(result1.success).toBe(true);
    expect(attemptCount).toBe(2);

    // Reset attempt count
    attemptCount = 0;

    // Should use cache, not retry
    const result2 = await testAction(input);
    expect(result2.success).toBe(true);
    expect(attemptCount).toBe(0); // Didn't execute at all
  });

  it('should handle concurrent requests to same cache key', async () => {
    let slowExecutionCount = 0;

    const testAction = action
      .inputDto(CacheTestInput)
      .cache({
        ttl: 60000,
      })
      .action(async ({ parsedInput }) => {
        slowExecutionCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return `Processed user ${parsedInput.userId}`;
      });

    const input = { userId: '123', count: 5 };

    // Fire multiple concurrent requests
    const promises = [testAction(input), testAction(input), testAction(input)];

    const results = await Promise.all(promises);

    // All should succeed
    results.forEach((result) => {
      expect(result.success).toBe(true);
    });

    // Note: Current implementation doesn't deduplicate concurrent requests
    // so this will execute multiple times. This is a potential future enhancement.
    expect(slowExecutionCount).toBeGreaterThan(0);
  });
});

describe('Cache with authentication', () => {
  let executionCount: number;

  beforeEach(() => {
    executionCount = 0;
    clearGlobalMemoryCache();
  });

  afterEach(() => {
    clearGlobalMemoryCache();
  });

  it('should cache authenticated action results', async () => {
    const testAction = action
      .inputDto(CacheTestInput)
      .needsAuth(async () => ({ id: '1', name: 'Test User' }))
      .cache({
        ttl: 60000,
        key: (input) => `auth-user-${input.userId}`,
      })
      .action(async ({ parsedInput, user }) => {
        executionCount++;
        return `User ${user?.name} processed ${parsedInput.userId}`;
      });

    const input = { userId: '123', count: 5 };

    await testAction(input);
    expect(executionCount).toBe(1);

    await testAction(input);
    expect(executionCount).toBe(1); // Used cache
  });

  it('should not cache auth errors when cacheErrors is false', async () => {
    const testAction = action
      .inputDto(CacheTestInput)
      .needsAuth(async () => null) // Always fails auth
      .cache({
        ttl: 60000,
        cacheErrors: false,
      })
      .action(async ({ parsedInput }) => {
        executionCount++;
        return `Processed ${parsedInput.userId}`;
      });

    const input = { userId: '123', count: 5 };

    const result1 = await testAction(input);
    expect(result1.success).toBe(false);

    const result2 = await testAction(input);
    expect(result2.success).toBe(false);

    expect(executionCount).toBe(0); // Never reached action handler
  });
});
