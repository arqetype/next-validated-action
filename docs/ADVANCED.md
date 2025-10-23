# Advanced Usage

This guide covers advanced features and patterns for `@arqetype/next-validated-action`.

## Table of Contents

- [Middleware](#middleware)
- [Retry Logic](#retry-logic)
- [Logging and Observability](#logging-and-observability)
- [Rate Limiting](#rate-limiting)
- [Custom Validation Options](#custom-validation-options)
- [Error Handling Patterns](#error-handling-patterns)
- [Type Guards](#type-guards)
- [Complex Authentication](#complex-authentication)
- [Nested Validation](#nested-validation)
- [Best Practices](#best-practices)

## Middleware

Middleware allows you to intercept and modify the action execution pipeline.

### Basic Middleware

```typescript
import { action } from '@arqetype/next-validated-action';

export const myAction = action
  .use(async (ctx, next) => {
    console.log('Before action execution');
    const result = await next();
    console.log('After action execution');
    return result;
  })
  .action(async ({ parsedInput }) => {
    return { success: true };
  });
```

### Multiple Middlewares

Middlewares are executed in the order they are defined:

```typescript
export const myAction = action
  .use(async (ctx, next) => {
    console.log('Middleware 1: Before');
    const result = await next();
    console.log('Middleware 1: After');
    return result;
  })
  .use(async (ctx, next) => {
    console.log('Middleware 2: Before');
    const result = await next();
    console.log('Middleware 2: After');
    return result;
  })
  .action(async ({ parsedInput }) => {
    console.log('Handler');
    return { success: true };
  });

// Output:
// Middleware 1: Before
// Middleware 2: Before
// Handler
// Middleware 2: After
// Middleware 1: After
```

### Timing Middleware

Track execution time:

```typescript
const timingMiddleware = async (ctx, next) => {
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;

  console.log(`Action took ${duration}ms`);

  return result;
};

export const myAction = action
  .use(timingMiddleware)
  .action(async ({ parsedInput }) => {
    // ... your logic
  });
```

### Error Handling Middleware

```typescript
const errorHandlerMiddleware = async (ctx, next) => {
  try {
    return await next();
  } catch (error) {
    console.error('Action error:', error);
    // You can transform the error here
    return {
      success: false,
      error: 'server',
      message: 'An unexpected error occurred',
    };
  }
};
```

### Short-Circuit Middleware

Prevent action execution based on conditions:

```typescript
const maintenanceMiddleware = async (ctx, next) => {
  const isMaintenanceMode = await checkMaintenanceMode();

  if (isMaintenanceMode) {
    return {
      success: false,
      error: 'server',
      message: 'Service is under maintenance',
    };
  }

  return await next();
};
```

### Context Access in Middleware

Middlewares have access to the action context:

```typescript
const auditMiddleware = async (ctx, next) => {
  console.log('Input:', ctx.parsedInput);
  console.log('User:', ctx.user);

  const result = await next();

  if (result.success) {
    await logAudit({
      user: ctx.user,
      action: 'user_action',
      input: ctx.parsedInput,
    });
  }

  return result;
};
```

## Retry Logic

Automatically retry failed actions.

### Basic Retry

```typescript
export const myAction = action
  .retry({ attempts: 3, delay: 1000 })
  .action(async ({ parsedInput }) => {
    // This will be retried up to 3 times with 1s delay
    const data = await fetchFromUnstableAPI();
    return { data };
  });
```

### Exponential Backoff

```typescript
export const myAction = action
  .retry({
    attempts: 5,
    delay: 1000,
    backoff: 'exponential', // 1s, 2s, 4s, 8s, 16s
  })
  .action(async ({ parsedInput }) => {
    return await callExternalService();
  });
```

### Conditional Retry

Combine with custom logic:

```typescript
export const myAction = action
  .retry({ attempts: 3, delay: 500 })
  .action(async ({ parsedInput }) => {
    try {
      return await fetchData();
    } catch (error) {
      // Only retry on specific errors
      if (isRetriableError(error)) {
        throw error; // Will trigger retry
      }
      // Don't retry on client errors
      return { success: false, error: 'client_error' };
    }
  });
```

## Logging and Observability

Add comprehensive logging to your actions.

### Basic Logger

```typescript
export const myAction = action
  .logger((level, message, meta) => {
    console.log(`[${level.toUpperCase()}] ${message}`, meta);
  })
  .action(async ({ parsedInput }) => {
    return { success: true };
  });
```

### Structured Logging

```typescript
import { logger } from './logger'; // Your logging library

export const myAction = action
  .logger((level, message, meta) => {
    logger[level]({
      message,
      ...meta,
      service: '@arqetype/next-validated-action',
      timestamp: new Date().toISOString(),
    });
  })
  .inputDto(MyInput)
  .action(async ({ parsedInput }) => {
    return { success: true };
  });
```

### Integration with Monitoring Services

```typescript
import * as Sentry from '@sentry/nextjs';

export const myAction = action
  .logger((level, message, meta) => {
    if (level === 'error') {
      Sentry.captureMessage(message, {
        level: 'error',
        extra: meta,
      });
    }

    // Also log to console or other services
    console.log(`[${level}] ${message}`, meta);
  })
  .action(async ({ parsedInput }) => {
    // Your logic
  });
```

### Custom Metrics

```typescript
let actionExecutionCount = 0;
let actionFailureCount = 0;

export const myAction = action
  .logger((level, message, meta) => {
    if (message === 'Action started') {
      actionExecutionCount++;
    }
    if (message === 'Handler execution error') {
      actionFailureCount++;
    }

    // Send to your metrics service
    sendMetrics({
      executions: actionExecutionCount,
      failures: actionFailureCount,
      successRate:
        (actionExecutionCount - actionFailureCount) / actionExecutionCount,
    });
  })
  .action(async ({ parsedInput }) => {
    // Your logic
  });
```

## Rate Limiting

While rate limiting enforcement must be implemented separately, you can store metadata:

```typescript
export const myAction = action
  .rateLimit({ maxCalls: 10, windowMs: 60000 }) // 10 calls per minute
  .inputDto(MyInput)
  .action(async ({ parsedInput }) => {
    return { success: true };
  });

// Access rate limit config
const config = myAction.getRateLimitConfig();
console.log(config); // { maxCalls: 10, windowMs: 60000 }
```

### Integration with Rate Limiter

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60000,
  max: 10,
});

export const myAction = action
  .rateLimit({ maxCalls: 10, windowMs: 60000 })
  .use(async (ctx, next) => {
    // Implement rate limiting in middleware
    const identifier = ctx.user?.id || 'anonymous';
    const allowed = await checkRateLimit(identifier);

    if (!allowed) {
      return {
        success: false,
        error: 'server',
        message: 'Rate limit exceeded',
      };
    }

    return await next();
  })
  .action(async ({ parsedInput }) => {
    return { success: true };
  });
```

## Custom Validation Options

Fine-tune class-validator behavior:

```typescript
export const myAction = action
  .inputDto(MyInput)
  .validationOptions({
    whitelist: true, // Strip non-whitelisted properties
    forbidNonWhitelisted: true, // Throw error on non-whitelisted properties
    stopAtFirstError: false, // Return all validation errors
    skipMissingProperties: false, // Don't skip missing properties
  })
  .action(async ({ parsedInput }) => {
    // parsedInput only contains validated properties
    return { success: true };
  });
```

### Validation Groups

```typescript
class CreateUserInput {
  @IsString()
  @IsNotEmpty({ groups: ['create'] })
  name: string;

  @IsEmail({}, { groups: ['create', 'update'] })
  email: string;

  @IsOptional({ groups: ['update'] })
  @IsString({ groups: ['update'] })
  bio?: string;
}

export const createUserAction = action
  .inputDto(CreateUserInput)
  .validationOptions({ groups: ['create'] })
  .action(async ({ parsedInput }) => {
    // Only 'create' group validations apply
  });

export const updateUserAction = action
  .inputDto(CreateUserInput)
  .validationOptions({ groups: ['update'] })
  .action(async ({ parsedInput }) => {
    // Only 'update' group validations apply
  });
```

## Error Handling Patterns

### Using Type Guards

```typescript
import { isSuccess, isInputError, isServerError } from '@arqetype/next-validated-action';

const result = await myAction({ data: 'test' });

if (isSuccess(result)) {
  console.log('Success:', result.data);
} else if (isInputError(result)) {
  console.error('Validation failed:', result.details);
} else if (isServerError(result)) {
  console.error('Server error:', result.message, result.cause);
}
```

### Unwrapping Results

```typescript
import { unwrap, unwrapOr } from '@arqetype/next-validated-action';

// Throw on error
try {
  const data = unwrap(await myAction({ data: 'test' }));
  console.log(data);
} catch (error) {
  console.error(error);
}

// Use default value
const data = unwrapOr(await myAction({ data: 'test' }), { default: true });
```

### Pattern Matching

```typescript
const result = await myAction({ data: 'test' });

switch (result.success) {
  case true:
    return result.data;
  case false:
    switch (result.error) {
      case 'input':
        return { validationErrors: result.details };
      case 'auth':
        return { requiresAuth: true };
      case 'server':
        return { serverError: result.message };
      default:
        return { unknownError: true };
    }
}
```

## Type Guards

Access detailed validation errors:

```typescript
import { isInputError } from '@arqetype/next-validated-action';

const result = await myAction({ email: 'invalid' });

if (isInputError(result)) {
  result.details?.forEach((error) => {
    console.log(`Field: ${error.field}`);
    console.log(`Constraints: ${error.constraints.join(', ')}`);
  });
}
```

## Complex Authentication

### Role-Based Access Control

```typescript
async function requireRole(role: string) {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  if (!user.roles.includes(role)) {
    throw new Error(`Requires ${role} role`);
  }

  return user;
}

export const adminAction = action
  .needsAuth(() => requireRole('admin'))
  .action(async ({ parsedInput, user }) => {
    // Only admins can access this
    return { success: true };
  });
```

### Permission Checks

```typescript
async function requirePermission(permission: string) {
  const user = await getCurrentUser();

  if (!user) return null;

  const hasPermission = await checkPermission(user.id, permission);

  if (!hasPermission) {
    throw new Error(`Missing permission: ${permission}`);
  }

  return user;
}

export const deleteUserAction = action
  .needsAuth(() => requirePermission('users.delete'))
  .action(async ({ parsedInput, user }) => {
    // Only users with delete permission can access
  });
```

### JWT Verification

```typescript
import { verify } from 'jsonwebtoken';

async function verifyToken() {
  const token = cookies().get('auth_token')?.value;

  if (!token) return null;

  try {
    const decoded = verify(token, process.env.JWT_SECRET!);
    return decoded as User;
  } catch (error) {
    return null;
  }
}

export const protectedAction = action
  .needsAuth(verifyToken)
  .action(async ({ parsedInput, user }) => {
    // Authenticated with JWT
  });
```

## Nested Validation

Validate complex nested structures:

```typescript
class AddressDto {
  @IsString()
  @IsNotEmpty()
  street: string;

  @IsString()
  city: string;

  @IsString()
  @Length(5, 5)
  zipCode: string;
}

class UserDto {
  @IsString()
  name: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  @IsArray()
  previousAddresses: AddressDto[];
}

export const createUserAction = action
  .inputDto(UserDto)
  .action(async ({ parsedInput }) => {
    // All nested objects are validated
    console.log(parsedInput.address.street);
    console.log(parsedInput.previousAddresses[0]?.city);
  });
```

## Best Practices

### 1. Separate DTOs from Domain Models

```typescript
// DTOs (for validation)
class CreateUserInputDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;
}

class CreateUserOutputDto {
  @IsString()
  id: string;
}

// Domain model
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export const createUserAction = action
  .inputDto(CreateUserInputDto)
  .outputDto(CreateUserOutputDto)
  .action(async ({ parsedInput }) => {
    const user: User = await createUser(parsedInput);

    // Map to output DTO
    return {
      id: user.id,
    };
  });
```

### 2. Reusable Middleware

Create a library of reusable middlewares:

```typescript
// middlewares/timing.ts
export const timingMiddleware = async (ctx, next) => {
  const start = Date.now();
  const result = await next();
  console.log(`Took ${Date.now() - start}ms`);
  return result;
};

// middlewares/audit.ts
export const auditMiddleware = async (ctx, next) => {
  const result = await next();
  if (result.success) {
    await logAudit({ user: ctx.user, action: 'performed' });
  }
  return result;
};

// Use them
export const myAction = action
  .use(timingMiddleware)
  .use(auditMiddleware)
  .action(async ({ parsedInput }) => {
    // ...
  });
```

### 3. Centralized Error Handling

```typescript
// errors/handler.ts
export function handleActionError(error: unknown) {
  if (error instanceof ValidationError) {
    return { success: false, error: 'input', message: error.message };
  }

  if (error instanceof AuthenticationError) {
    return { success: false, error: 'auth', message: 'Not authenticated' };
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);

  return { success: false, error: 'server', message: 'Internal error' };
}
```

### 4. Action Composition

```typescript
// Create base actions with common configuration
const authenticatedAction = action
  .needsAuth(getCurrentUser)
  .logger(customLogger);

const adminAction = authenticatedAction.use(requireAdminMiddleware);

// Use the base actions
export const updateSettingsAction = authenticatedAction
  .inputDto(UpdateSettingsDto)
  .action(async ({ parsedInput, user }) => {
    // Automatically authenticated
  });

export const deleteUserAction = adminAction
  .inputDto(DeleteUserDto)
  .action(async ({ parsedInput, user }) => {
    // Automatically authenticated + admin check
  });
```

### 5. Testing Actions

```typescript
import { action } from '@arqetype/next-validated-action';

describe('myAction', () => {
  it('should validate input', async () => {
    const testAction = action
      .inputDto(MyInputDto)
      .action(async ({ parsedInput }) => {
        return { success: true };
      });

    const result = await testAction({ invalid: 'data' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('input');
  });
});
```

## Performance Optimization

### Lazy Validation

Only validate when necessary:

```typescript
export const myAction = action
  .validationOptions({ skipMissingProperties: true })
  .inputDto(MyInputDto)
  .action(async ({ parsedInput }) => {
    // Validation skips undefined properties
  });
```

### Caching

Cache authentication results:

```typescript
const userCache = new Map();

async function getCachedUser() {
  const sessionId = cookies().get('session')?.value;

  if (!sessionId) return null;

  if (userCache.has(sessionId)) {
    return userCache.get(sessionId);
  }

  const user = await fetchUserFromDb(sessionId);
  userCache.set(sessionId, user);

  return user;
}

export const myAction = action
  .needsAuth(getCachedUser)
  .action(async ({ parsedInput, user }) => {
    // User retrieved from cache if available
  });
```
