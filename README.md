# @arqetype/next-validated-action

Type-safe Next.js server actions with comprehensive validation, middleware, retry logic, and more.

[![npm version](https://img.shields.io/npm/v/@arqetype/next-validated-action.svg)](https://www.npmjs.com/package/@arqetype/next-validated-action)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔒 **Type-safe** - Full TypeScript support with generic types
- ✅ **Input/Output Validation** - Built-in validation using class-validator
- 🔐 **Authentication** - Flexible authentication handling
- 🎯 **Structured Error Handling** - Detailed, type-safe error responses
- 🔄 **Retry Logic** - Automatic retry with configurable backoff strategies
- 💾 **Caching/Memoization** - Built-in result caching with configurable storage
- 🎭 **Middleware Support** - Intercept and modify action execution
- 📊 **Logging & Observability** - Built-in logging capabilities
- 🚀 **Developer Experience** - Fluent builder pattern API
- 🧪 **Fully Tested** - Comprehensive test coverage
- 📦 **Zero Config** - Works out of the box

## 📦 Installation

```bash
npm install @arqetype/next-validated-action class-validator class-transformer reflect-metadata
```

## 🚀 Quick Start

### 1. Define your DTOs

```typescript
import { IsString, IsEmail, IsNotEmpty, MinLength } from 'class-validator';

class SignUpInput {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

class SignUpOutput {
  @IsString()
  userId: string;

  @IsString()
  message: string;
}
```

### 2. Create your server action

```typescript
'use server';

import { action } from '@arqetype/next-validated-action';

export const signUpAction = action
  .inputDto(SignUpInput)
  .outputDto(SignUpOutput)
  .action(async ({ parsedInput }) => {
    const user = await createUser(parsedInput);

    return {
      userId: user.id,
      message: 'User created successfully',
    };
  });
```

### 3. Use in your components

```typescript
import { signUpAction } from './actions';
import { isSuccess, isInputError } from '@arqetype/next-validated-action';

async function handleSignUp(formData: FormData) {
  const result = await signUpAction({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (isSuccess(result)) {
    console.log('User created:', result.data.userId);
  } else if (isInputError(result)) {
    console.error('Validation errors:', result.details);
  } else {
    console.error('Error:', result.message);
  }
}
```

## 📚 Core Concepts

### Authentication

Require authentication for protected actions:

```typescript
import { getCurrentUser } from './auth';

export const updateProfileAction = action
  .inputDto(UpdateProfileInput)
  .needsAuth(getCurrentUser)
  .action(async ({ parsedInput, user }) => {
    // user is guaranteed to exist here
    await updateUserProfile(user.id, parsedInput);
    return { success: true };
  });
```

### Middleware

Add middleware to intercept action execution:

```typescript
export const myAction = action
  .use(async (ctx, next) => {
    console.log('Before action');
    const result = await next();
    console.log('After action');
    return result;
  })
  .inputDto(MyInput)
  .action(async ({ parsedInput }) => {
    return { success: true };
  });
```

### Retry Logic

Automatically retry failed actions:

```typescript
export const myAction = action
  .retry({
    attempts: 3,
    delay: 1000,
    backoff: 'exponential', // or 'linear'
  })
  .action(async ({ parsedInput }) => {
    return await callUnstableAPI();
  });
```

### Caching

Cache expensive operations to avoid redundant processing:

```typescript
export const getUserProfile = action
  .inputDto(UserInput)
  .cache({
    ttl: 60000, // Cache for 60 seconds
    key: (input) => `user-${input.userId}`, // Custom cache key
  })
  .action(async ({ parsedInput }) => {
    // This expensive query will be cached
    return await db.user.findUnique({ where: { id: parsedInput.userId } });
  });
```

**Advanced caching options:**

```typescript
import { MemoryCacheStorage } from '@arqetype/next-validated-action';

// Use custom storage instance
const myCache = new MemoryCacheStorage();

export const cachedAction = action
  .cache({
    ttl: 300000, // 5 minutes
    storage: myCache, // Custom storage
    cacheErrors: false, // Don't cache errors (default)
    key: (input) => `custom-${input.id}`, // Custom key generator
  })
  .action(async ({ parsedInput }) => {
    return await expensiveOperation(parsedInput);
  });

// Get cache statistics
const stats = myCache.getStats();
console.log(`Cache size: ${stats.size}, expired: ${stats.expired}`);
```

See the [Cache Documentation](./docs/CACHE.md) for more details.

### Logging

Add logging for observability:

```typescript
export const myAction = action
  .logger((level, message, meta) => {
    console.log(`[${level}] ${message}`, meta);
  })
  .inputDto(MyInput)
  .action(async ({ parsedInput }) => {
    return { success: true };
  });
```

### Validation Options

Configure class-validator options:

```typescript
export const myAction = action
  .inputDto(MyInput)
  .validationOptions({
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: false,
  })
  .action(async ({ parsedInput }) => {
    return { success: true };
  });
```

### Hooks

Add lifecycle hooks for observability, logging, and telemetry:

```typescript
export const myAction = action
  .inputDto(MyInput)
  .outputDto(MyOutput)

  // Success hook - track successful completions
  .on('success', async (ctx) => {
    analytics.track('action_success', {
      actionId: ctx.actionId,
      duration: ctx.duration,
      data: ctx.result.data,
    });
  })

  // Error hooks - send to monitoring services
  .on('error', async (ctx) => {
    Sentry.captureException(ctx.error, {
      extra: {
        actionId: ctx.actionId,
        errorType: ctx.errorType,
      },
    });
  })

  // Specific error handlers
  .on('inputValidationError', async (ctx) => {
    console.error('Validation failed:', ctx.details);
  })

  .on('serverError', async (ctx) => {
    logError(ctx.message, ctx.cause);
  })

  // Lifecycle hooks
  .on('beforeExecution', async (ctx) => {
    console.time(`action-${ctx.actionId}`);
  })

  .on('afterExecution', async (ctx) => {
    console.timeEnd(`action-${ctx.actionId}`);
  })

  // Retry monitoring
  .retry({ attempts: 3, delay: 1000 })
  .on('retry', async (ctx) => {
    console.log(`Retry ${ctx.attempt}/${ctx.maxAttempts}`);
  })

  // Always runs (success or failure)
  .on('complete', async (ctx) => {
    await cleanup(ctx.actionId);
    metrics.record('action.duration', ctx.duration);
  })

  .action(async ({ parsedInput }) => {
    return await processData(parsedInput);
  });
```

#### Available Hook Events

**Lifecycle Hooks:**

- `beforeValidation` - Before input validation starts
- `afterValidation` - After successful input validation
- `beforeExecution` - Before handler execution
- `afterExecution` - After handler execution

**Success Hook:**

- `success` - Action completed successfully

**Error Hooks:**

- `error` - Any error occurred (catches all error types)
- `authError` - Authentication failed
- `inputValidationError` - Input validation failed
- `outputValidationError` - Output validation failed (bug in handler)
- `serverError` - Handler threw an error

**Other Hooks:**

- `retry` - Retry attempt is happening
- `complete` - Always called at the end (success or failure)

#### Hook Context

Each hook receives a context object with relevant data:

```typescript
// Example: success hook context
{
  actionId: string;        // Unique action execution ID
  timestamp: Date;         // When the hook fired
  user?: TUser;           // Authenticated user (if any)
  parsedInput: TInput;    // Validated input
  result: { success: true; data: TOutput };
  duration: number;       // Execution time in ms
}

// Example: error hook context
{
  actionId: string;
  timestamp: Date;
  user?: TUser;
  errorType: 'auth' | 'input' | 'output' | 'server';
  message: string;
  error: unknown;         // The actual error
  parsedInput?: TInput;
}
```

#### Async Hooks

Hooks can be async (awaited) or sync (fire-and-forget):

```typescript
action
  // Async - waits for completion
  .on('success', async (ctx) => {
    await auditLog.record(ctx.result);
  })

  // Sync - fire and forget
  .on('error', (ctx) => {
    errorTracker.capture(ctx.error);
  });
```

**Note:** Hooks are non-breaking - if a hook throws an error, it will be logged but won't affect the action result.

## 🎯 Error Handling

### Type Guards

Use type guards to handle different error types:

```typescript
import {
  isSuccess,
  isError,
  isInputError,
  isServerError,
  isAuthError,
} from '@arqetype/next-validated-action';

const result = await myAction({ data: 'test' });

if (isSuccess(result)) {
  // TypeScript knows result.data exists
  console.log(result.data);
} else if (isInputError(result)) {
  // Handle validation errors
  result.details?.forEach((error) => {
    console.log(`${error.field}: ${error.constraints.join(', ')}`);
  });
} else if (isAuthError(result)) {
  // Redirect to login
  redirect('/login');
} else if (isServerError(result)) {
  // Handle server errors
  console.error(result.message, result.cause);
}
```

### Unwrapping Results

```typescript
import { unwrap, unwrapOr } from '@arqetype/next-validated-action';

// Throw on error
try {
  const data = unwrap(await myAction({ input: 'test' }));
  console.log(data);
} catch (error) {
  console.error(error);
}

// Use default value
const data = unwrapOr(await myAction({ input: 'test' }), { default: true });
```

## 📖 API Reference

### ActionClientBuilder Methods

- `.inputDto(dto)` - Specify input validation DTO
- `.outputDto(dto)` - Specify output validation DTO
- `.needsAuth(authHandler)` - Require authentication
- `.use(middleware)` - Add middleware
- `.logger(logger)` - Configure logging
- `.retry(config)` - Configure retry logic
- `.cache(config)` - Configure caching/memoization
- `.rateLimit(config)` - Store rate limit metadata
- `.validationOptions(options)` - Configure validation options
- `.on(event, callback)` - Register a lifecycle hook
- `.action(handler)` - Define the action handler

### Result Type

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: 'input';
      message: string;
      details?: ValidationError[];
    }
  | { success: false; error: 'server'; message: string; cause?: unknown }
  | {
      success: false;
      error: 'output';
      message: string;
      details?: ValidationError[];
    }
  | { success: false; error: 'auth'; message: string };
```

### Type Guards

- `isSuccess(result)` - Check if successful
- `isError(result)` - Check if error
- `isInputError(result)` - Check if input validation error
- `isServerError(result)` - Check if server error
- `isOutputError(result)` - Check if output validation error
- `isAuthError(result)` - Check if authentication error
- `unwrap(result)` - Extract data or throw
- `unwrapOr(result, defaultValue)` - Extract data or return default

## 🔧 Advanced Usage

### Multiple Middlewares

Middlewares execute in order (onion model):

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

### Complex Authentication

```typescript
async function requireRole(role: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!user.roles.includes(role)) {
    throw new Error(`Requires ${role} role`);
  }
  return user;
}

export const adminAction = action
  .needsAuth(() => requireRole('admin'))
  .action(async ({ parsedInput, user }) => {
    // Only admins can access
  });
```

### Nested Validation

```typescript
import { ValidateNested, Type } from 'class-transformer';

class AddressDto {
  @IsString()
  street: string;

  @IsString()
  city: string;
}

class UserDto {
  @IsString()
  name: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}

export const createUserAction = action
  .inputDto(UserDto)
  .action(async ({ parsedInput }) => {
    // Nested objects are validated
    console.log(parsedInput.address.street);
  });
```

### Action Composition

Create base actions with common configuration:

```typescript
const authenticatedAction = action
  .needsAuth(getCurrentUser)
  .logger(customLogger);

const adminAction = authenticatedAction.use(requireAdminMiddleware);

// Use base actions
export const updateSettings = authenticatedAction
  .inputDto(UpdateSettingsDto)
  .action(async ({ parsedInput, user }) => {
    // Automatically authenticated
  });

export const deleteUser = adminAction
  .inputDto(DeleteUserDto)
  .action(async ({ parsedInput, user }) => {
    // Automatically authenticated + admin
  });
```

## 📝 Documentation

- [API Reference](./docs/API.md) - Complete API documentation
- [Cache Documentation](./docs/CACHE.md) - Caching and memoization guide
- [Advanced Usage](./docs/ADVANCED.md) - Advanced patterns and examples
- [Contributing](./CONTRIBUTING.md) - Contribution guidelines

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 License

MIT © [arqetype](https://github.com/arqetype)

## 🙏 Acknowledgments

- [class-validator](https://github.com/typestack/class-validator) - Decorator-based validation
- [class-transformer](https://github.com/typestack/class-transformer) - Object transformation
- Next.js team for server actions

## 💡 Examples

Check out the [examples](./examples) directory for more usage examples:

- Basic CRUD operations
- Authentication patterns
- Caching strategies
- Middleware usage
- Error handling strategies
- Complex validation scenarios

## 🔗 Links

- [Documentation](./docs)
- [GitHub Repository](https://github.com/arqetype/next-validated-action)
- [NPM Package](https://www.npmjs.com/package/@arqetype/next-validated-action)
- [Issue Tracker](https://github.com/arqetype/next-validated-action/issues)

## ⚡ Performance

@arqetype/next-validated-action is designed to be lightweight and performant:

- Tree-shakeable exports
- Minimal runtime overhead
- Efficient validation caching
- Zero dependencies (except peer dependencies)

## 🛠️ TypeScript

Full TypeScript support with:

- Strict mode compatible
- Generic type inference
- Discriminated unions for results
- Type guards for narrowing

## 🚦 Status

- ✅ Stable API
- ✅ Production ready
- ✅ Actively maintained
- ✅ Comprehensive tests

---

Made with ❤️ for the Next.js community
