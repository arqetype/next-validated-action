# API Reference

Complete API documentation for `@arqetype/next-validated-action`.

## Table of Contents

- [ActionClientBuilder](#actionclientbuilder)
- [Types](#types)
- [Type Guards](#type-guards)
- [Utility Functions](#utility-functions)
- [Validation](#validation)

---

## ActionClientBuilder

The main builder class for creating type-safe server actions.

### `action`

Default exported instance to start building actions.

```typescript
import { action } from '@arqetype/next-validated-action';

const myAction = action.inputDto(MyInput).action(async ({ parsedInput }) => {
  return { success: true };
});
```

### Methods

#### `.inputDto<TInput>(dto: ClassConstructor<TInput>)`

Specify the input DTO class for validation.

**Parameters:**

- `dto`: A class decorated with `class-validator` decorators

**Returns:** `ActionClientBuilder<TInput, TOutput, TUser>`

**Example:**

```typescript
class SignUpInput {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;
}

const signUpAction = action
  .inputDto(SignUpInput)
  .action(async ({ parsedInput }) => {
    // parsedInput is typed as SignUpInput
    console.log(parsedInput.name, parsedInput.email);
  });
```

---

#### `.outputDto<TOutput>(dto: ClassConstructor<TOutput>)`

Specify the output DTO class for validation.

**Parameters:**

- `dto`: A class decorated with `class-validator` decorators

**Returns:** `ActionClientBuilder<TInput, TOutput, TUser>`

**Example:**

```typescript
class SignUpOutput {
  @IsString()
  userId: string;

  @IsString()
  message: string;
}

const signUpAction = action
  .outputDto(SignUpOutput)
  .action(async ({ parsedInput }) => {
    return {
      userId: '123',
      message: 'User created',
    };
  });
```

---

#### `.needsAuth<TUser>(authHandler: AuthHandler<TUser>)`

Require authentication for the action.

**Parameters:**

- `authHandler`: Async function that returns the authenticated user or null/undefined

**Returns:** `ActionClientBuilder<TInput, TOutput, TUser>`

**Example:**

```typescript
async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

const protectedAction = action
  .needsAuth(getCurrentUser)
  .action(async ({ parsedInput, user }) => {
    // user is typed and guaranteed to exist
    console.log(user.id);
  });
```

**Authentication Errors:**

- Returns `{ success: false, error: 'auth', message: 'Authentication required' }` if auth handler returns null/undefined
- Returns `{ success: false, error: 'auth', message: 'Authentication failed' }` if auth handler throws

---

#### `.use(middleware: Middleware)`

Add middleware to the action pipeline.

**Parameters:**

- `middleware`: Function with signature `(context, next) => Promise<ActionResult>`

**Returns:** `ActionClientBuilder<TInput, TOutput, TUser>`

**Example:**

```typescript
const myAction = action
  .use(async (ctx, next) => {
    console.log('Before action');
    const result = await next();
    console.log('After action');
    return result;
  })
  .action(async ({ parsedInput }) => {
    return { success: true };
  });
```

**Middleware Execution Order:**
Middlewares are executed in the order they are added (onion model).

---

#### `.logger(logger: Logger)`

Configure logging for observability.

**Parameters:**

- `logger`: Function with signature `(level, message, meta?) => void`

**Returns:** `ActionClientBuilder<TInput, TOutput, TUser>`

**Example:**

```typescript
const myAction = action
  .logger((level, message, meta) => {
    console.log(`[${level.toUpperCase()}] ${message}`, meta);
  })
  .action(async ({ parsedInput }) => {
    return { success: true };
  });
```

**Log Levels:**

- `info`: Action start/completion
- `debug`: Validation, authentication steps
- `warn`: Validation failures, non-critical issues
- `error`: Handler errors, critical failures

---

#### `.retry(config: RetryConfig)`

Configure automatic retry logic.

**Parameters:**

- `config`: Object with the following properties:
  - `attempts` (number): Maximum number of attempts
  - `delay` (number): Initial delay in milliseconds
  - `backoff?` ('linear' | 'exponential'): Backoff strategy (default: 'linear')

**Returns:** `ActionClientBuilder<TInput, TOutput, TUser>`

**Example:**

```typescript
const myAction = action
  .retry({
    attempts: 3,
    delay: 1000,
    backoff: 'exponential',
  })
  .action(async ({ parsedInput }) => {
    return await callUnstableAPI();
  });
```

**Backoff Strategies:**

- **Linear**: delay \* attempt (1s, 2s, 3s)
- **Exponential**: delay \* 2^(attempt-1) (1s, 2s, 4s, 8s)

---

#### `.rateLimit(config: RateLimitConfig)`

Store rate limiting metadata (informational).

**Parameters:**

- `config`: Object with the following properties:
  - `maxCalls` (number): Maximum calls allowed
  - `windowMs` (number): Time window in milliseconds

**Returns:** `ActionClientBuilder<TInput, TOutput, TUser>`

**Example:**

```typescript
const myAction = action
  .rateLimit({ maxCalls: 10, windowMs: 60000 })
  .action(async ({ parsedInput }) => {
    return { success: true };
  });
```

**Note:** This method only stores metadata. Actual rate limiting must be implemented separately (e.g., in middleware).

---

#### `.validationOptions(options: ValidatorOptions)`

Configure class-validator validation options.

**Parameters:**

- `options`: class-validator options object

**Returns:** `ActionClientBuilder<TInput, TOutput, TUser>`

**Example:**

```typescript
const myAction = action
  .validationOptions({
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: false,
  })
  .inputDto(MyInput)
  .action(async ({ parsedInput }) => {
    return { success: true };
  });
```

**Common Options:**

- `whitelist`: Strip non-whitelisted properties
- `forbidNonWhitelisted`: Throw error on non-whitelisted properties
- `stopAtFirstError`: Stop validation on first error
- `skipMissingProperties`: Skip validation of missing properties
- `groups`: Validation groups to apply

---

#### `.action(handler: ActionHandler)`

Define the action handler function.

**Parameters:**

- `handler`: Async function that receives context and returns output

**Returns:** `(input?: unknown) => Promise<ActionResult<TOutput>>`

**Example:**

```typescript
const myAction = action
  .inputDto(MyInput)
  .outputDto(MyOutput)
  .action(async ({ parsedInput, user }) => {
    // Your business logic here
    const result = await doSomething(parsedInput);
    return result;
  });
```

**Handler Context:**

- `parsedInput`: Validated input (typed according to inputDto)
- `user?`: Authenticated user (typed according to needsAuth, undefined if not authenticated)

---

#### `.getRateLimitConfig()`

Get the configured rate limit metadata.

**Returns:** `RateLimitConfig | undefined`

**Example:**

```typescript
const builder = action.rateLimit({ maxCalls: 10, windowMs: 60000 });
const config = builder.getRateLimitConfig();
console.log(config); // { maxCalls: 10, windowMs: 60000 }
```

---

## Types

### `ActionResult<T>`

The result type returned by all actions.

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: 'input';
      message: string;
      details?: ValidationError[];
    }
  | {
      success: false;
      error: 'server';
      message: string;
      cause?: unknown;
    }
  | {
      success: false;
      error: 'output';
      message: string;
      details?: ValidationError[];
    }
  | { success: false; error: 'auth'; message: string };
```

**Success:**

- `success: true`
- `data: T` - The validated output

**Input Error:**

- `success: false`
- `error: "input"`
- `message: string` - Human-readable error message
- `details?: ValidationError[]` - Detailed validation errors

**Server Error:**

- `success: false`
- `error: "server"`
- `message: string` - Error message
- `cause?: unknown` - Original error object

**Output Error:**

- `success: false`
- `error: "output"`
- `message: string` - Human-readable error message
- `details?: ValidationError[]` - Detailed validation errors

**Auth Error:**

- `success: false`
- `error: "auth"`
- `message: string` - Authentication error message

---

### `ActionContext<TInput, TUser>`

Context passed to action handlers and middleware.

```typescript
type ActionContext<TInput = unknown, TUser = unknown> = {
  parsedInput: TInput;
  user?: TUser;
};
```

**Properties:**

- `parsedInput`: Validated and transformed input
- `user`: Authenticated user (only present if needsAuth was used)

---

### `AuthHandler<TUser>`

Authentication handler function type.

```typescript
type AuthHandler<TUser = unknown> = () => Promise<TUser | null | undefined>;
```

**Returns:**

- The authenticated user object
- `null` or `undefined` if not authenticated

---

### `Middleware<TContext, TResult>`

Middleware function type.

```typescript
type Middleware<TContext = any, TResult = any> = (
  context: TContext,
  next: () => Promise<TResult>
) => Promise<TResult>;
```

**Parameters:**

- `context`: The action context
- `next`: Function to call the next middleware or handler

**Returns:**

- The action result (can be modified by middleware)

---

### `Logger`

Logger function type.

```typescript
type Logger = (
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  meta?: Record<string, any>
) => void;
```

**Parameters:**

- `level`: Log level
- `message`: Log message
- `meta`: Additional metadata

---

### `RetryConfig`

Retry configuration object.

```typescript
type RetryConfig = {
  attempts: number;
  delay: number;
  backoff?: 'linear' | 'exponential';
};
```

**Properties:**

- `attempts`: Maximum number of retry attempts
- `delay`: Initial delay in milliseconds
- `backoff`: Backoff strategy (default: 'linear')

---

### `RateLimitConfig`

Rate limit configuration object.

```typescript
type RateLimitConfig = {
  maxCalls: number;
  windowMs: number;
};
```

**Properties:**

- `maxCalls`: Maximum number of calls allowed
- `windowMs`: Time window in milliseconds

---

### `ValidationError`

Detailed validation error for a field.

```typescript
type ValidationError = {
  field: string;
  constraints: string[];
};
```

**Properties:**

- `field`: Name of the field that failed validation
- `constraints`: Array of constraint violation messages

---

### `ValidationOptions`

Options for class-validator validation.

```typescript
type ValidationOptions = {
  skipMissingProperties?: boolean;
  whitelist?: boolean;
  forbidNonWhitelisted?: boolean;
  forbidUnknownValues?: boolean;
  stopAtFirstError?: boolean;
};
```

Refer to [class-validator documentation](https://github.com/typestack/class-validator) for full options.

---

## Type Guards

Functions to narrow ActionResult types.

### `isSuccess<T>(result: ActionResult<T>)`

Check if result is successful.

**Returns:** `result is { success: true; data: T }`

**Example:**

```typescript
const result = await myAction({ data: 'test' });

if (isSuccess(result)) {
  console.log(result.data); // TypeScript knows this exists
}
```

---

### `isError<T>(result: ActionResult<T>)`

Check if result is an error.

**Returns:** `result is Extract<ActionResult<T>, { success: false }>`

**Example:**

```typescript
if (isError(result)) {
  console.error(result.message);
}
```

---

### `isInputError<T>(result: ActionResult<T>)`

Check if result is an input validation error.

**Returns:** `result is Extract<ActionResult<T>, { success: false; error: "input" }>`

**Example:**

```typescript
if (isInputError(result)) {
  result.details?.forEach((error) => {
    console.log(`${error.field}: ${error.constraints.join(', ')}`);
  });
}
```

---

### `isServerError<T>(result: ActionResult<T>)`

Check if result is a server error.

**Returns:** `result is Extract<ActionResult<T>, { success: false; error: "server" }>`

**Example:**

```typescript
if (isServerError(result)) {
  console.error('Server error:', result.message);
  console.error('Cause:', result.cause);
}
```

---

### `isOutputError<T>(result: ActionResult<T>)`

Check if result is an output validation error.

**Returns:** `result is Extract<ActionResult<T>, { success: false; error: "output" }>`

**Example:**

```typescript
if (isOutputError(result)) {
  console.error('Output validation failed:', result.details);
}
```

---

### `isAuthError<T>(result: ActionResult<T>)`

Check if result is an authentication error.

**Returns:** `result is Extract<ActionResult<T>, { success: false; error: "auth" }>`

**Example:**

```typescript
if (isAuthError(result)) {
  redirect('/login');
}
```

---

### `unwrap<T>(result: ActionResult<T>)`

Extract data or throw error.

**Returns:** `T`

**Throws:** `Error` if result is not successful

**Example:**

```typescript
try {
  const data = unwrap(await myAction({ input: 'test' }));
  console.log(data);
} catch (error) {
  console.error('Action failed:', error);
}
```

---

### `unwrapOr<T>(result: ActionResult<T>, defaultValue: T)`

Extract data or return default value.

**Returns:** `T`

**Example:**

```typescript
const data = unwrapOr(await myAction({ input: 'test' }), { default: true });
```

---

## Utility Functions

### `validateData<T>(dtoClass, data, errorPrefix?, options?)`

Validate data against a DTO class.

**Parameters:**

- `dtoClass`: DTO class constructor
- `data`: Data to validate
- `errorPrefix?`: Prefix for error messages (default: "Invalid data")
- `options?`: Validation options

**Returns:** `Promise<ValidateResponse<T>>`

**Example:**

```typescript
import { validateData } from '@arqetype/next-validated-action';

class MyDto {
  @IsString()
  name: string;
}

const result = await validateData(MyDto, { name: 'John' });

if (result.valid) {
  console.log(result.instance.name);
} else {
  console.error(result.errors, result.details);
}
```

---

### `formatValidationErrors(details: ValidationError[])`

Format validation errors into a human-readable message.

**Returns:** `string`

**Example:**

```typescript
import { formatValidationErrors } from '@arqetype/next-validated-action';

const message = formatValidationErrors([
  { field: 'email', constraints: ['must be an email'] },
  { field: 'name', constraints: ['should not be empty'] },
]);

console.log(message);
// "Validation failed for 2 field(s): email, name"
```

---

### `withRetry<T>(fn, config)`

Execute a function with retry logic.

**Parameters:**

- `fn`: Async function to execute
- `config`: Retry configuration

**Returns:** `Promise<T>`

**Example:**

```typescript
import { withRetry } from '@arqetype/next-validated-action';

const result = await withRetry(
  async () => {
    return await fetchData();
  },
  { attempts: 3, delay: 1000 }
);
```

---

### `isRetriableError(error: unknown)`

Check if an error should trigger a retry.

**Returns:** `boolean`

**Example:**

```typescript
import { isRetriableError } from '@arqetype/next-validated-action';

try {
  await fetchData();
} catch (error) {
  if (isRetriableError(error)) {
    // Retry the operation
  }
}
```

---

### `formatError(error: unknown)`

Format an error into a string message.

**Returns:** `string`

**Example:**

```typescript
import { formatError } from '@arqetype/next-validated-action';

try {
  throw new Error('Something went wrong');
} catch (error) {
  const message = formatError(error);
  console.log(message); // "Something went wrong"
}
```

---

### `deepClone<T>(obj: T)`

Deep clone an object.

**Returns:** `T`

**Example:**

```typescript
import { deepClone } from '@arqetype/next-validated-action';

const original = { nested: { value: 1 } };
const cloned = deepClone(original);

cloned.nested.value = 2;
console.log(original.nested.value); // 1
```

---

### `debounce<T>(fn: T, delay: number)`

Create a debounced version of a function.

**Returns:** Debounced function

**Example:**

```typescript
import { debounce } from '@arqetype/next-validated-action';

const debouncedLog = debounce((msg: string) => {
  console.log(msg);
}, 1000);

debouncedLog('Hello'); // Only logs after 1s of inactivity
```

---

### `throttle<T>(fn: T, delay: number)`

Create a throttled version of a function.

**Returns:** Throttled function

**Example:**

```typescript
import { throttle } from '@arqetype/next-validated-action';

const throttledLog = throttle((msg: string) => {
  console.log(msg);
}, 1000);

throttledLog('Hello'); // Logs at most once per second
```

---

## Validation

### Using class-validator

All validation is done using [class-validator](https://github.com/typestack/class-validator) decorators.

**Common Decorators:**

```typescript
import {
  IsString,
  IsNumber,
  IsEmail,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsEnum,
  Matches,
  IsDate,
  IsUrl,
  IsUUID,
} from 'class-validator';

class ExampleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsNumber()
  @Min(0)
  @Max(120)
  age: number;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsArray()
  @IsString({ each: true })
  tags: string[];
}
```

Refer to the [class-validator documentation](https://github.com/typestack/class-validator) for all available decorators and options.
