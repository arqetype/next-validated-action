# Hooks System

The hooks system in `@arqetype/next-validated-action` provides a powerful way to observe and react to different stages of action execution. Hooks are perfect for logging, monitoring, analytics, error tracking, and other cross-cutting concerns.

## Table of Contents

- [Overview](#overview)
- [Available Hooks](#available-hooks)
- [Hook Context](#hook-context)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Common Use Cases](#common-use-cases)

## Overview

Hooks allow you to execute code at specific points in the action lifecycle without modifying the core action logic. They are:

- **Non-breaking**: Hook errors won't fail your action
- **Composable**: Multiple hooks of the same type can be registered
- **Async-friendly**: Supports both sync and async callbacks
- **Type-safe**: Full TypeScript support with typed context objects

### Basic Usage

```typescript
import { action } from '@arqetype/next-validated-action';

export const myAction = action
  .inputDto(MyInput)
  .on('success', async (ctx) => {
    console.log('Action succeeded!', ctx.result);
  })
  .on('error', async (ctx) => {
    console.error('Action failed!', ctx.error);
  })
  .action(async ({ parsedInput }) => {
    return { success: true };
  });
```

## Available Hooks

### Lifecycle Hooks

These hooks fire during the normal action execution flow:

#### `beforeValidation`

Fires before input validation starts.

**Context:**

```typescript
{
  actionId: string;
  timestamp: Date;
  user?: TUser;
  rawInput: unknown;
}
```

**Example:**

```typescript
.on('beforeValidation', async (ctx) => {
  console.log('Validating input:', ctx.rawInput);
})
```

#### `afterValidation`

Fires after successful input validation.

**Context:**

```typescript
{
  actionId: string;
  timestamp: Date;
  user?: TUser;
  rawInput: unknown;
  validatedInput: TInput;
}
```

**Example:**

```typescript
.on('afterValidation', async (ctx) => {
  console.log('Input validated:', ctx.validatedInput);
})
```

#### `beforeExecution`

Fires before the action handler executes.

**Context:**

```typescript
{
  actionId: string;
  timestamp: Date;
  user?: TUser;
  parsedInput: TInput;
}
```

**Example:**

```typescript
.on('beforeExecution', async (ctx) => {
  console.time(`action-${ctx.actionId}`);
})
```

#### `afterExecution`

Fires after the action handler completes (before output validation).

**Context:**

```typescript
{
  actionId: string;
  timestamp: Date;
  user?: TUser;
  parsedInput: TInput;
  rawOutput: TOutput;
}
```

**Example:**

```typescript
.on('afterExecution', async (ctx) => {
  console.timeEnd(`action-${ctx.actionId}`);
})
```

### Success Hook

#### `success`

Fires when the action completes successfully (after all validation passes).

**Context:**

```typescript
{
  actionId: string;
  timestamp: Date;
  user?: TUser;
  parsedInput: TInput;
  result: { success: true; data: TOutput };
  duration: number; // milliseconds
}
```

**Example:**

```typescript
.on('success', async (ctx) => {
  analytics.track('action_success', {
    actionId: ctx.actionId,
    duration: ctx.duration,
  });
})
```

### Error Hooks

#### `error`

Fires on any error (auth, input validation, output validation, or server errors). This is a catch-all error hook.

**Context:**

```typescript
{
  actionId: string;
  timestamp: Date;
  user?: TUser;
  errorType: 'auth' | 'input' | 'output' | 'server';
  message: string;
  error: unknown;
  parsedInput?: TInput;
}
```

**Example:**

```typescript
.on('error', async (ctx) => {
  Sentry.captureException(ctx.error, {
    extra: {
      actionId: ctx.actionId,
      errorType: ctx.errorType,
    },
  });
})
```

#### `authError`

Fires when authentication fails.

**Context:**

```typescript
{
  actionId: string;
  timestamp: Date;
  user?: TUser;
  message: string;
  error: unknown;
}
```

**Example:**

```typescript
.on('authError', async (ctx) => {
  securityMonitor.logFailedAuth({
    timestamp: ctx.timestamp,
    message: ctx.message,
  });
})
```

#### `inputValidationError`

Fires when input validation fails.

**Context:**

```typescript
{
  actionId: string;
  timestamp: Date;
  user?: TUser;
  rawInput: unknown;
  message: string;
  details: ValidationError[];
}
```

**Example:**

```typescript
.on('inputValidationError', async (ctx) => {
  console.error('Validation errors:', ctx.details);
  ctx.details.forEach(err => {
    console.log(`${err.field}: ${err.constraints.join(', ')}`);
  });
})
```

#### `outputValidationError`

Fires when output validation fails (indicates a bug in the action handler).

**Context:**

```typescript
{
  actionId: string;
  timestamp: Date;
  user?: TUser;
  parsedInput: TInput;
  rawOutput: unknown;
  message: string;
  details: ValidationError[];
}
```

**Example:**

```typescript
.on('outputValidationError', async (ctx) => {
  alertDevelopers({
    severity: 'high',
    message: 'Output validation failed - bug in action handler!',
    details: ctx.details,
  });
})
```

#### `serverError`

Fires when the action handler throws an error.

**Context:**

```typescript
{
  actionId: string;
  timestamp: Date;
  user?: TUser;
  parsedInput?: TInput;
  message: string;
  cause: unknown;
  error: unknown;
}
```

**Example:**

```typescript
.on('serverError', async (ctx) => {
  logger.error('Handler error:', {
    message: ctx.message,
    cause: ctx.cause,
  });
})
```

### Retry Hook

#### `retry`

Fires on each retry attempt (when retry is configured).

**Context:**

```typescript
{
  actionId: string;
  timestamp: Date;
  user?: TUser;
  attempt: number;      // Current attempt (2, 3, etc.)
  maxAttempts: number;  // Total attempts configured
  delay: number;        // Delay before this retry (ms)
  error: unknown;       // Previous error that triggered retry
}
```

**Example:**

```typescript
.retry({ attempts: 3, delay: 1000 })
.on('retry', async (ctx) => {
  console.warn(
    `Retry ${ctx.attempt}/${ctx.maxAttempts} after ${ctx.delay}ms`
  );
  metrics.increment('action.retry');
})
```

### Completion Hook

#### `complete`

Always fires at the end of action execution, regardless of success or failure.

**Context:**

```typescript
{
  actionId: string;
  timestamp: Date;
  user?: TUser;
  parsedInput?: TInput;
  result: ActionResult<TOutput>;
  duration: number; // milliseconds
}
```

**Example:**

```typescript
.on('complete', async (ctx) => {
  await cleanup(ctx.actionId);
  metrics.record('action.duration', ctx.duration, {
    success: ctx.result.success,
  });
})
```

## Hook Context

All hooks receive a context object with common fields:

- `actionId`: Unique identifier for this action execution
- `timestamp`: When the hook fired
- `user`: Authenticated user (if authentication is configured)

Additional fields depend on the hook type (see individual hook documentation above).

## Examples

### Error Tracking with Sentry

```typescript
import * as Sentry from '@sentry/nextjs';

export const myAction = action
  .inputDto(MyInput)
  .on('error', async (ctx) => {
    Sentry.captureException(ctx.error, {
      extra: {
        actionId: ctx.actionId,
        errorType: ctx.errorType,
        user: ctx.user,
      },
    });
  })
  .action(async ({ parsedInput }) => {
    // Your action logic
  });
```

### Analytics Tracking

```typescript
export const createUserAction = action
  .inputDto(CreateUserInput)
  .on('success', async (ctx) => {
    analytics.track('user_created', {
      userId: ctx.result.data.userId,
      duration: ctx.duration,
      timestamp: ctx.timestamp,
    });
  })
  .on('inputValidationError', async (ctx) => {
    analytics.track('validation_failed', {
      fields: ctx.details.map((d) => d.field),
    });
  })
  .action(async ({ parsedInput }) => {
    const user = await createUser(parsedInput);
    return { userId: user.id };
  });
```

### Performance Monitoring

```typescript
export const heavyAction = action
  .inputDto(MyInput)
  .on('beforeExecution', async (ctx) => {
    performance.mark(`action-start-${ctx.actionId}`);
  })
  .on('afterExecution', async (ctx) => {
    performance.mark(`action-end-${ctx.actionId}`);
    performance.measure(
      `action-${ctx.actionId}`,
      `action-start-${ctx.actionId}`,
      `action-end-${ctx.actionId}`
    );
  })
  .on('complete', async (ctx) => {
    if (ctx.duration > 1000) {
      logger.warn('Slow action detected', {
        actionId: ctx.actionId,
        duration: ctx.duration,
      });
    }
  })
  .action(async ({ parsedInput }) => {
    return await expensiveOperation(parsedInput);
  });
```

### Audit Logging

```typescript
export const deleteUserAction = action
  .needsAuth(getCurrentUser)
  .inputDto(DeleteUserInput)
  .on('success', async (ctx) => {
    await auditLog.create({
      action: 'user.deleted',
      actor: ctx.user?.id,
      target: ctx.parsedInput.userId,
      timestamp: ctx.timestamp,
      result: 'success',
    });
  })
  .on('error', async (ctx) => {
    await auditLog.create({
      action: 'user.deleted',
      actor: ctx.user?.id,
      timestamp: ctx.timestamp,
      result: 'failed',
      error: ctx.message,
    });
  })
  .action(async ({ parsedInput, user }) => {
    await deleteUser(parsedInput.userId);
    return { success: true };
  });
```

### Retry Monitoring

```typescript
export const unstableApiAction = action
  .retry({ attempts: 3, delay: 1000, backoff: 'exponential' })
  .on('retry', async (ctx) => {
    logger.warn('Retrying action', {
      actionId: ctx.actionId,
      attempt: ctx.attempt,
      maxAttempts: ctx.maxAttempts,
      delay: ctx.delay,
    });

    // Send metrics
    metrics.increment('api.retry', {
      attempt: ctx.attempt.toString(),
    });
  })
  .on('complete', async (ctx) => {
    if (!ctx.result.success) {
      alerting.notify('Action failed after all retries', {
        actionId: ctx.actionId,
      });
    }
  })
  .action(async () => {
    return await callUnstableAPI();
  });
```

## Best Practices

### 1. Keep Hooks Lightweight

Hooks should be fast and non-blocking. Avoid heavy operations in hooks:

```typescript
// ❌ Bad - heavy synchronous operation
.on('success', async (ctx) => {
  await processLargeDataset(ctx.result.data);
})

// ✅ Good - queue for background processing
.on('success', async (ctx) => {
  await queue.add('process-data', {
    actionId: ctx.actionId,
    data: ctx.result.data
  });
})
```

### 2. Handle Hook Errors Gracefully

Hook errors are caught and logged, but write defensive code:

```typescript
.on('success', async (ctx) => {
  try {
    await externalService.notify(ctx.result);
  } catch (error) {
    // Graceful degradation
    logger.error('Failed to notify external service', error);
  }
})
```

### 3. Use Specific Hooks When Possible

Prefer specific error hooks over the generic `error` hook:

```typescript
// ✅ Good - targeted handling
.on('inputValidationError', async (ctx) => {
  formAnalytics.trackValidationError(ctx.details);
})
.on('serverError', async (ctx) => {
  Sentry.captureException(ctx.cause);
})

// ❌ Less ideal - need to check error type
.on('error', async (ctx) => {
  if (ctx.errorType === 'input') {
    formAnalytics.trackValidationError(ctx);
  } else if (ctx.errorType === 'server') {
    Sentry.captureException(ctx.error);
  }
})
```

### 4. Async vs Sync Hooks

Choose based on your needs:

```typescript
// Async - waits for completion (audit logs, critical operations)
.on('success', async (ctx) => {
  await auditLog.record(ctx.result);
})

// Sync - fire and forget (metrics, non-critical tracking)
.on('success', (ctx) => {
  metrics.increment('action.success');
})
```

### 5. Multiple Hooks for Separation of Concerns

Register multiple hooks of the same type for different concerns:

```typescript
export const myAction = action
  .on('success', async (ctx) => {
    // Analytics
    analytics.track('action_success', ctx);
  })
  .on('success', async (ctx) => {
    // Audit logging
    await auditLog.record(ctx);
  })
  .on('success', async (ctx) => {
    // Notifications
    await notifyUser(ctx.user, ctx.result);
  })
  .action(async ({ parsedInput }) => {
    // Action logic
  });
```

### 6. Use `complete` for Cleanup

Always use the `complete` hook for cleanup operations:

```typescript
.on('complete', async (ctx) => {
  // Runs regardless of success or failure
  await cleanupTempFiles(ctx.actionId);
  await releaseResources(ctx.actionId);
})
```

## Common Use Cases

### Error Tracking (Sentry, Bugsnag, etc.)

```typescript
.on('error', async (ctx) => {
  errorTracker.capture(ctx.error, {
    actionId: ctx.actionId,
    errorType: ctx.errorType,
    user: ctx.user,
  });
})
```

### Analytics (Google Analytics, Mixpanel, etc.)

```typescript
.on('success', async (ctx) => {
  analytics.track('action_completed', {
    actionId: ctx.actionId,
    duration: ctx.duration,
  });
})
```

### Logging (Winston, Pino, etc.)

```typescript
.on('complete', async (ctx) => {
  logger.info('Action completed', {
    actionId: ctx.actionId,
    success: ctx.result.success,
    duration: ctx.duration,
  });
})
```

### Metrics (Prometheus, Datadog, etc.)

```typescript
.on('complete', async (ctx) => {
  metrics.histogram('action.duration', ctx.duration, {
    success: ctx.result.success.toString(),
  });
})
```

### Audit Trails

```typescript
.on('success', async (ctx) => {
  await auditLog.create({
    action: 'resource.updated',
    actor: ctx.user?.id,
    timestamp: ctx.timestamp,
    changes: ctx.result.data,
  });
})
```

### Security Monitoring

```typescript
.on('authError', async (ctx) => {
  securityMonitor.logFailedAuth({
    timestamp: ctx.timestamp,
    ip: await getClientIP(),
  });
})
```

---

For more information, see:

- [API Reference](./API.md)
- [Advanced Usage](./ADVANCED.md)
- [Examples](../examples/)
