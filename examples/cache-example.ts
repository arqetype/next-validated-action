/**
 * Cache and Memoization Examples
 *
 * This file demonstrates various caching strategies using next-validated-action
 */

import { action, MemoryCacheStorage } from '@arqetype/next-validated-action';
import { IsString, IsNumber, Min, Max } from 'class-validator';

// ============================================================================
// Example 1: Basic Caching
// ============================================================================

class UserIdInput {
  @IsString()
  userId!: string;
}

/**
 * Cache expensive database queries
 * Results are cached for 60 seconds
 */
export const getUserProfile = action
  .inputDto(UserIdInput)
  .cache({
    ttl: 60000, // 1 minute
  })
  .action(async ({ parsedInput }) => {
    console.log('Fetching user profile from database...');

    // Simulate expensive database query
    const user = {
      id: parsedInput.userId,
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: new Date(),
    };

    return user;
  });

// Usage:
// const result1 = await getUserProfile({ userId: '123' }); // Executes query
// const result2 = await getUserProfile({ userId: '123' }); // Uses cache
// const result3 = await getUserProfile({ userId: '456' }); // Different input, executes query

// ============================================================================
// Example 2: Custom Cache Key
// ============================================================================

class SearchInput {
  @IsString()
  query!: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  page!: number;
}

/**
 * Cache search results, ignoring pagination
 * All pages of the same query share the same cache
 */
export const searchProducts = action
  .inputDto(SearchInput)
  .cache({
    ttl: 300000, // 5 minutes
    key: (input) => `search:${input.query.toLowerCase()}`,
  })
  .action(async ({ parsedInput }) => {
    console.log(
      `Searching for: ${parsedInput.query}, page: ${parsedInput.page}`
    );

    // Simulate API call
    const results = [
      { id: 1, name: `Result 1 for ${parsedInput.query}` },
      { id: 2, name: `Result 2 for ${parsedInput.query}` },
      { id: 3, name: `Result 3 for ${parsedInput.query}` },
    ];

    return results;
  });

// Usage:
// await searchProducts({ query: 'laptop', page: 1 }); // Executes search
// await searchProducts({ query: 'laptop', page: 2 }); // Uses cache (same query)
// await searchProducts({ query: 'phone', page: 1 });  // Different query, executes search

// ============================================================================
// Example 3: Custom Storage Instance
// ============================================================================

// Create a dedicated cache for this specific action
const weatherCache = new MemoryCacheStorage();

class WeatherInput {
  @IsString()
  city!: string;
}

/**
 * Cache weather data with custom storage
 * Allows independent cache management
 */
export const getWeather = action
  .inputDto(WeatherInput)
  .cache({
    ttl: 600000, // 10 minutes
    storage: weatherCache,
    key: (input) => `weather:${input.city.toLowerCase()}`,
  })
  .action(async ({ parsedInput }) => {
    console.log(`Fetching weather for ${parsedInput.city}...`);

    // Simulate weather API call
    return {
      city: parsedInput.city,
      temperature: Math.floor(Math.random() * 30) + 10,
      condition: 'Sunny',
      timestamp: new Date(),
    };
  });

// Cache management functions
export async function clearWeatherCache() {
  await weatherCache.clear();
  console.log('Weather cache cleared');
}

export function getWeatherCacheStats() {
  const stats = weatherCache.getStats();
  return {
    totalEntries: stats.size,
    expiredEntries: stats.expired,
  };
}

// ============================================================================
// Example 4: Caching Errors
// ============================================================================

class ApiInput {
  @IsString()
  endpoint!: string;
}

/**
 * Cache successful results but retry on errors
 * Useful for unreliable external APIs
 */
export const callExternalAPI = action
  .inputDto(ApiInput)
  .cache({
    ttl: 120000, // 2 minutes
    cacheErrors: false, // Don't cache errors
  })
  .retry({
    attempts: 3,
    delay: 1000,
    backoff: 'exponential',
  })
  .action(async ({ parsedInput }) => {
    console.log(`Calling API: ${parsedInput.endpoint}`);

    // Simulate API that might fail
    const shouldFail = Math.random() > 0.7;

    if (shouldFail) {
      throw new Error('API temporarily unavailable');
    }

    return {
      success: true,
      data: `Response from ${parsedInput.endpoint}`,
      timestamp: Date.now(),
    };
  });

/**
 * Cache both successful and failed results
 * Useful when you want to avoid hammering a failing service
 */
export const callRateLimitedAPI = action
  .inputDto(ApiInput)
  .cache({
    ttl: 60000, // 1 minute
    cacheErrors: true, // Cache errors too
  })
  .action(async ({ parsedInput }) => {
    console.log(`Calling rate-limited API: ${parsedInput.endpoint}`);

    // Simulate rate-limited API
    const isRateLimited = Math.random() > 0.5;

    if (isRateLimited) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    return {
      success: true,
      data: `Response from ${parsedInput.endpoint}`,
    };
  });

// ============================================================================
// Example 5: Multi-Tenant Caching
// ============================================================================

class TenantInput {
  @IsString()
  tenantId!: string;

  @IsString()
  resourceId!: string;
}

/**
 * Cache data per tenant
 * Ensures tenant isolation in cache
 */
export const getTenantResource = action
  .inputDto(TenantInput)
  .cache({
    ttl: 180000, // 3 minutes
    key: (input) => `tenant:${input.tenantId}:resource:${input.resourceId}`,
  })
  .action(async ({ parsedInput }) => {
    console.log(
      `Fetching resource ${parsedInput.resourceId} for tenant ${parsedInput.tenantId}`
    );

    return {
      tenantId: parsedInput.tenantId,
      resourceId: parsedInput.resourceId,
      data: { name: 'Resource Data', value: 123 },
      accessedAt: new Date(),
    };
  });

// ============================================================================
// Example 6: Cache with Authentication
// ============================================================================

class UserDataInput {
  @IsString()
  dataType!: string;
}

/**
 * Cache user-specific data
 * Each user gets their own cached results
 */
export const getUserData = action
  .inputDto(UserDataInput)
  .needsAuth(async () => {
    // Simulate authentication
    return { id: 'user-123', role: 'user' };
  })
  .cache({
    ttl: 30000, // 30 seconds
    key: (input) => `userdata:${input.dataType}`, // Note: In production, include user ID
  })
  .action(async ({ parsedInput, user }) => {
    console.log(`Fetching ${parsedInput.dataType} for user ${user?.id}`);

    return {
      userId: user?.id,
      dataType: parsedInput.dataType,
      data: { value: 'User-specific data' },
      retrievedAt: new Date(),
    };
  });

// ============================================================================
// Example 7: Cache Statistics and Monitoring
// ============================================================================

// Create monitored cache
const monitoredCache = new MemoryCacheStorage();

class DataInput {
  @IsString()
  id!: string;
}

export const getMonitoredData = action
  .inputDto(DataInput)
  .cache({
    ttl: 60000,
    storage: monitoredCache,
  })
  .action(async ({ parsedInput }) => {
    return {
      id: parsedInput.id,
      data: 'Some data',
      timestamp: Date.now(),
    };
  });

/**
 * Monitor cache performance
 */
export function monitorCache() {
  setInterval(() => {
    const stats = monitoredCache.getStats();
    console.log('Cache Statistics:', {
      size: stats.size,
      expired: stats.expired,
      hitRate: '95%', // You would calculate this based on tracking
    });

    // Alert if cache is growing too large
    if (stats.size > 1000) {
      console.warn('⚠️ Cache size exceeded 1000 entries');
    }

    // Alert if many entries are expired
    if (stats.expired > stats.size * 0.3) {
      console.warn('⚠️ More than 30% of cache entries are expired');
    }
  }, 60000); // Check every minute
}

// ============================================================================
// Example 8: Cache Invalidation
// ============================================================================

import { getGlobalMemoryCache } from '@arqetype/next-validated-action';

class UpdateUserInput {
  @IsString()
  userId!: string;

  @IsString()
  name!: string;
}

/**
 * Update user and invalidate cache
 */
export const updateUser = action
  .inputDto(UpdateUserInput)
  .action(async ({ parsedInput }) => {
    console.log(`Updating user ${parsedInput.userId}`);

    // Simulate database update
    const updatedUser = {
      id: parsedInput.userId,
      name: parsedInput.name,
      updatedAt: new Date(),
    };

    // Invalidate the user's cached profile
    const cache = getGlobalMemoryCache();
    const cacheKey = `user:${parsedInput.userId}:profile`;
    await cache.delete(cacheKey);

    console.log(`Cache invalidated for key: ${cacheKey}`);

    return updatedUser;
  });

// ============================================================================
// Example 9: Complex Cache Keys with Multiple Parameters
// ============================================================================

class ReportInput {
  @IsString()
  reportType!: string;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsString()
  departmentId!: string;
}

/**
 * Generate reports with complex caching logic
 */
export const generateReport = action
  .inputDto(ReportInput)
  .cache({
    ttl: 3600000, // 1 hour - reports are expensive
    key: (input) =>
      `report:${input.reportType}:${input.departmentId}:${input.startDate}:${input.endDate}`,
  })
  .action(async ({ parsedInput }) => {
    console.log('Generating report...');

    // Simulate expensive report generation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      reportType: parsedInput.reportType,
      department: parsedInput.departmentId,
      period: `${parsedInput.startDate} to ${parsedInput.endDate}`,
      data: [
        { metric: 'Revenue', value: 100000 },
        { metric: 'Expenses', value: 75000 },
        { metric: 'Profit', value: 25000 },
      ],
      generatedAt: new Date(),
    };
  });

// ============================================================================
// Example 10: Cache without TTL (Permanent Cache)
// ============================================================================

class ConfigInput {
  @IsString()
  configKey!: string;
}

/**
 * Cache configuration that rarely changes
 * No TTL means it's cached until manually cleared or server restarts
 */
export const getSystemConfig = action
  .inputDto(ConfigInput)
  .cache({
    // No TTL - cached indefinitely
    key: (input) => `config:${input.configKey}`,
  })
  .action(async ({ parsedInput }) => {
    console.log(`Loading config: ${parsedInput.configKey}`);

    return {
      key: parsedInput.configKey,
      value: 'Some configuration value',
      loadedAt: new Date(),
    };
  });

/**
 * Manually clear config cache when needed
 */
export async function reloadSystemConfig(configKey: string) {
  const cache = getGlobalMemoryCache();
  await cache.delete(`config:${configKey}`);
  console.log(`Config cache cleared for: ${configKey}`);
}
