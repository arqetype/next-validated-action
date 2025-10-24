# Throttle

Throttling allows you to limit the execution frequency of server actions to prevent abuse, control load, and protect resources.

## Table of Contents

- [Overview](#overview)
- [Basic Usage](#basic-usage)
- [Configuration Options](#configuration-options)
- [Throttle Strategies](#throttle-strategies)
- [Custom Identifiers](#custom-identifiers)
- [Integration with Other Features](#integration-with-other-features)
- [Use Cases](#use-cases)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)

## Overview

Throttling limits how many times an action can be called within a specific time window. This is useful for:

- **Rate limiting**: Prevent abuse by limiting API calls
- **Spam prevention**: Limit form submissions or message sending
- **Resource protection**: Control load on external APIs or databases
- **Cost control**: Limit expensive operations

## Basic Usage

```typescript
import { action } from '@arqetype/next-validated-action';
import { IsString } from 'class-validator';

class SendMessageInput {
  @IsString()
  message!: string;
}

export const sendMessage = action
  .inputDto(SendMessageInput)
  .throttle({
    maxCalls: 5, // Maximum 5 calls
    windowMs: 60000, // Per minute (60,000ms)
    strategy: 'fixed', // Fixed time window
  })
  .action(async ({ parsedInput }) => {
    // Send message logic
    return { sent: true };
  });
```

When the limit is exceeded:

```typescript
const result = await sendMessage({ message: 'Hello!' });

if (!result.success && result.message.includes('Too many requests')) {
  console.error('Rate limit exceeded');
  // Error message includes retry information:
  // "Too many requests. Limit: 5 calls per 60000ms. Try again in 45s."
}
```

## Configuration Options

### `maxCalls` (required)

The maximum number of calls allowed within the time window.

```typescript
.throttle({
  maxCalls: 10,  // Allow 10 calls
  windowMs: 60000,
})
```

### `windowMs` (required)

The time window in milliseconds.

```typescript
.throttle({
  maxCalls: 10,
  windowMs: 60000,  // 1 minute window
})
```

Common window values:

- 1 second: `1000`
- 1 minute: `60000`
- 5 minutes: `300000`
- 1 hour: `3600000`

### `strategy` (optional)

The throttling strategy to use. Default: `'fixed'`

```typescript
.throttle({
  maxCalls: 10,
  windowMs: 60000,
  strategy: 'fixed',  // or 'sliding'
})
```

### `identifier` (optional)

Function to determine the throttle scope (per-user, per-IP, etc.). If not provided, throttling applies globally.

```typescript
.throttle({
  maxCalls: 10,
  windowMs: 60000,
  identifier: (ctx) => ctx.user?.id || 'anonymous',
})
```

## Throttle Strategies

### Fixed Window

Resets the counter at fixed intervals. Simpler and more memory-efficient.

```typescript
.throttle({
  maxCalls: 5,
  windowMs: 60000,
  strategy: 'fixed',
})
```

**How it works:**

- Window starts at first call
- Counter resets completely when window expires
- All calls within a window count against the limit

**Pros:**

- Lower memory usage
- Simpler logic
- Predictable reset times

**Cons:**

- Can allow burst traffic at window boundaries
- Less granular control

**Example:**

```
Time:     0s   10s   20s   30s   40s   50s   60s   70s
Calls:    ●●●  ●●    -     -     -     -     ●●●●● ●●
Allowed:  ✓✓✓  ✓✓    -     -     -     -     ✓✓✓✓✓ ✓✓
          [---- Window 1: 5 calls ----]  [---- Window 2: 7 calls ----]
```

### Sliding Window

Tracks individual call timestamps for more accurate rate limiting.

```typescript
.throttle({
  maxCalls: 5,
  windowMs: 60000,
  strategy: 'sliding',
})
```

**How it works:**

- Tracks timestamp of each call
- Removes expired timestamps from the window
- Allows new calls as old ones expire

**Pros:**

- More accurate rate limiting
- Prevents burst traffic
- Smoother distribution of calls

**Cons:**

- Higher memory usage (stores timestamps)
- Slightly more complex

**Example:**

```
Time:     0s   10s   20s   30s   40s   50s   60s   70s
Calls:    ●●●  ●●    -     ●     -     -     ●     ●
Allowed:  ✓✓✓  ✓✓    -     ✗     -     -     ✓     ✓
          [5 calls in sliding 60s window]
```

## Custom Identifiers

### Global Throttle (Default)

All users share the same throttle limit:

```typescript
.throttle({
  maxCalls: 100,
  windowMs: 60000,
  // No identifier = global throttle
})
```

### Per-User Throttle

Each user has their own separate limit:

```typescript
.throttle({
  maxCalls: 10,
  windowMs: 60000,
  identifier: (ctx) => ctx.user?.id || 'anonymous',
})
```

### Per-Input Throttle

Throttle based on input data:

```typescript
.throttle({
  maxCalls: 3,
  windowMs: 3600000,  // 3 per hour
  identifier: (ctx) => ctx.parsedInput?.email || 'unknown',
})
```

### Per-IP Throttle

Throttle based on IP address (requires middleware):

```typescript
.use(async (ctx, next) => {
  // Extract IP from request headers
  (ctx as any).ip = request.headers.get('x-forwarded-for') || 'unknown';
  return await next();
})
.throttle({
  maxCalls: 50,
  windowMs: 60000,
  identifier: (ctx) => (ctx as any).ip || 'unknown',
})
```

### Combined Identifier

Combine multiple factors:

```typescript
.throttle({
  maxCalls: 10,
  windowMs: 60000,
  identifier: (ctx) => {
    const userId = ctx.user?.id || 'anonymous';
    const endpoint = ctx.parsedInput?.endpoint || 'default';
    return `${userId}:${endpoint}`;
  },
})
```

## Integration with Other Features

### With Authentication

Throttle is checked after authentication, so you can use user data in the identifier:

```typescript
export const createPost = action
  .inputDto(CreatePostInput)
  .needsAuth(async () => {
    return await getCurrentUser();
  })
  .throttle({
    maxCalls: 3,
    windowMs: 3600000,
    identifier: (ctx) => ctx.user?.id || 'anonymous',
  })
  .action(async ({ parsedInput, user }) => {
    // Create post logic
  });
```

### With Validation

Invalid inputs fail validation before hitting the throttle:

```typescript
export const submitForm = action
  .inputDto(FormInput) // Validated first
  .throttle({
    // Then throttle
    maxCalls: 5,
    windowMs: 60000,
  })
  .action(async ({ parsedInput }) => {
    // Handle submission
  });
```

### With Retry

Throttle counts only incoming requests, not retry attempts:

```typescript
export const callExternalAPI = action
  .inputDto(ApiInput)
  .retry({
    attempts: 3,
    delay: 1000,
  })
  .throttle({
    maxCalls: 10,
    windowMs: 60000,
  })
  .action(async ({ parsedInput }) => {
    // If this fails and retries, it only counts as 1 call
  });
```

**Note:** Throttle errors are NOT retried, even if retry is configured.

### With Cache

Cached responses don't trigger throttle checks:

```typescript
export const fetchData = action
  .inputDto(DataInput)
  .cache({
    ttl: 60000,
  })
  .throttle({
    maxCalls: 10,
    windowMs: 60000,
  })
  .action(async ({ parsedInput }) => {
    // Cache hits don't count against throttle
  });
```

### With Middleware

Throttle is checked after middleware:

```typescript
export const protectedAction = action
  .inputDto(MyInput)
  .use(loggingMiddleware)
  .throttle({
    maxCalls: 5,
    windowMs: 60000,
  })
  .action(async ({ parsedInput }) => {
    // Throttled requests don't run middleware
  });
```

## Use Cases

### API Rate Limiting

```typescript
export const callExternalAPI = action
  .inputDto(ApiInput)
  .throttle({
    maxCalls: 100,
    windowMs: 60000, // 100 calls per minute
    strategy: 'sliding',
  })
  .action(async ({ parsedInput }) => {
    const response = await fetch(
      `https://api.example.com/${parsedInput.endpoint}`
    );
    return await response.json();
  });
```

### Email Sending

```typescript
export const sendEmail = action
  .inputDto(EmailInput)
  .throttle({
    maxCalls: 10,
    windowMs: 300000, // 10 emails per 5 minutes
    strategy: 'sliding',
    identifier: (ctx) => ctx.parsedInput?.to || 'unknown',
  })
  .action(async ({ parsedInput }) => {
    await sendEmailService(parsedInput);
    return { sent: true };
  });
```

### Password Reset

```typescript
export const resetPassword = action
  .inputDto(ResetPasswordInput)
  .throttle({
    maxCalls: 2,
    windowMs: 3600000, // 2 attempts per hour
    strategy: 'sliding',
    identifier: (ctx) => ctx.parsedInput?.email || 'unknown',
  })
  .action(async ({ parsedInput }) => {
    await sendPasswordResetEmail(parsedInput.email);
    return { sent: true };
  });
```

### Form Submission

```typescript
export const submitContactForm = action
  .inputDto(ContactFormInput)
  .throttle({
    maxCalls: 5,
    windowMs: 60000, // 5 submissions per minute
    strategy: 'fixed',
  })
  .action(async ({ parsedInput }) => {
    await saveContactForm(parsedInput);
    return { success: true };
  });
```

### Search Queries

```typescript
export const search = action
  .inputDto(SearchInput)
  .throttle({
    maxCalls: 20,
    windowMs: 10000, // 20 searches per 10 seconds
    strategy: 'sliding',
  })
  .action(async ({ parsedInput }) => {
    return await performSearch(parsedInput.query);
  });
```

## API Reference

### `checkThrottle(actionId, identifier, config)`

Manually check if a call should be throttled.

```typescript
import { checkThrottle } from '@arqetype/next-validated-action';

const result = checkThrottle('action-id', 'user-123', {
  maxCalls: 10,
  windowMs: 60000,
  strategy: 'fixed',
});

console.log(result);
// {
//   allowed: false,
//   resetTime: 1234567890000,
//   current: 10,
//   limit: 10,
//   remaining: 0
// }
```

### `resetThrottle(actionId, identifier?)`

Reset throttle state for an action.

```typescript
import { resetThrottle } from '@arqetype/next-validated-action';

// Reset for specific identifier
resetThrottle('action-id', 'user-123');

// Reset for all identifiers
resetThrottle('action-id');
```

### `resetAllThrottles()`

Clear all throttle states.

```typescript
import { resetAllThrottles } from '@arqetype/next-validated-action';

resetAllThrottles();
```

### `getThrottleState(actionId, identifier)`

Get current throttle state for debugging.

```typescript
import { getThrottleState } from '@arqetype/next-validated-action';

const state = getThrottleState('action-id', 'user-123');
console.log(state);
// {
//   calls: 5,
//   windowStart: 1234567890000,
//   age: 12345
// }
```

## Best Practices

### 1. Choose the Right Strategy

- **Fixed window**: Use for simpler scenarios with predictable reset times
- **Sliding window**: Use when you need more accurate rate limiting

### 2. Set Appropriate Limits

```typescript
// Too strict - might frustrate users
.throttle({ maxCalls: 1, windowMs: 60000 })

// Too lenient - won't prevent abuse
.throttle({ maxCalls: 1000, windowMs: 1000 })

// Balanced - allows normal use, prevents abuse
.throttle({ maxCalls: 10, windowMs: 60000 })
```

### 3. Use Per-User Throttling for User Actions

```typescript
// Good: Each user has their own limit
.throttle({
  maxCalls: 10,
  windowMs: 60000,
  identifier: (ctx) => ctx.user?.id || 'anonymous',
})

// Bad: All users share one limit (unless that's what you want)
.throttle({
  maxCalls: 10,
  windowMs: 60000,
})
```

### 4. Provide Clear Error Messages

The library automatically provides informative error messages:

```typescript
const result = await throttledAction(input);

if (!result.success && result.message.includes('Too many requests')) {
  // Extract retry time from message
  const match = result.message.match(/Try again in (\d+)s/);
  if (match) {
    const seconds = parseInt(match[1]);
    showUserMessage(`Please wait ${seconds} seconds before trying again`);
  }
}
```

### 5. Consider Multiple Throttle Levels

For different user tiers:

```typescript
const getThrottleConfig = (userTier: string) => {
  switch (userTier) {
    case 'premium':
      return { maxCalls: 100, windowMs: 60000 };
    case 'basic':
      return { maxCalls: 20, windowMs: 60000 };
    default:
      return { maxCalls: 5, windowMs: 60000 };
  }
};

export const createAction = (userTier: string) =>
  action
    .inputDto(MyInput)
    .throttle(getThrottleConfig(userTier))
    .action(async ({ parsedInput }) => {
      // Action logic
    });
```

### 6. Test Your Throttle Configuration

```typescript
import { resetAllThrottles } from '@arqetype/next-validated-action';

describe('Throttled Action', () => {
  beforeEach(() => {
    resetAllThrottles();
  });

  it('should throttle after limit', async () => {
    // Make maxCalls requests
    for (let i = 0; i < 5; i++) {
      const result = await myAction(input);
      expect(result.success).toBe(true);
    }

    // Next call should be throttled
    const result = await myAction(input);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Too many requests');
  });
});
```

### 7. Monitor Throttle Metrics

Use hooks to track throttle events:

```typescript
export const myAction = action
  .inputDto(MyInput)
  .throttle({
    maxCalls: 10,
    windowMs: 60000,
  })
  .on('serverError', async (ctx) => {
    if (ctx.message.includes('Too many requests')) {
      // Log throttle event for monitoring
      await logThrottleEvent({
        actionId: ctx.actionId,
        timestamp: ctx.timestamp,
        user: ctx.user,
      });
    }
  })
  .action(async ({ parsedInput }) => {
    // Action logic
  });
```

### 8. Handle Distributed Systems

For distributed systems, consider using a shared cache backend:

```typescript
// Note: Current implementation uses in-memory storage
// For distributed systems, implement a custom storage using Redis:

import Redis from 'ioredis';

class RedisThrottleStorage {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async checkAndIncrement(key: string, maxCalls: number, windowMs: number) {
    const multi = this.redis.multi();
    multi.incr(key);
    multi.pexpire(key, windowMs);
    const results = await multi.exec();
    const count = results[0][1] as number;

    return {
      allowed: count <= maxCalls,
      current: count,
    };
  }
}

// Future enhancement: Allow custom storage backends
```

## Error Handling

When throttle limit is exceeded:

```typescript
const result = await throttledAction(input);

if (!result.success) {
  if (
    result.error === 'server' &&
    result.message.includes('Too many requests')
  ) {
    // Handle throttle error
    console.error('Throttle limit exceeded');

    // Extract reset time
    const retryMatch = result.message.match(/Try again in (\d+)s/);
    if (retryMatch) {
      const retryAfter = parseInt(retryMatch[1]);
      // Show countdown to user
    }
  } else {
    // Handle other server errors
  }
}
```

## Related Features

- [Cache](./CACHE.md) - Cache responses to reduce load
- [Debounce](./DEBOUNCE.md) - Delay execution until inputs stabilize
- [Hooks](./HOOKS.md) - Monitor throttle events
- [Advanced Features](./ADVANCED.md) - Combine multiple features
