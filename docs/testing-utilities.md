# Testing Utilities

The `@arqetype/next-validated-action` library provides comprehensive testing utilities to help you write robust tests for your server actions.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [MockActionBuilder](#mockactionbuilder)
  - [createMockAction](#createmockaction)
  - [Result Creators](#result-creators)
  - [Context Creators](#context-creators)
  - [Hook Spies](#hook-spies)
  - [Wait Utilities](#wait-utilities)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)

## Installation

The testing utilities are included in the main package and can be imported from a separate entry point:

```typescript
import {
  createMockAction,
  createTestContext,
  MockActionBuilder,
  // ... other utilities
} from '@arqetype/next-validated-action/testing';
```

## Quick Start

Here's a simple example of mocking a server action for testing:

```typescript
import { createMockAction } from '@arqetype/next-validated-action/testing';
import { isSuccess } from '@arqetype/next-validated-action';

// Mock a successful action
const mockAction = createMockAction()
  .mockSuccess({ userId: '123', name: 'John Doe' })
  .build();

// Use in tests
const result = await mockAction({ name: 'John' });

expect(isSuccess(result)).toBe(true);
if (isSuccess(result)) {
  expect(result.data.userId).toBe('123');
}
```

## API Reference

### MockActionBuilder

The `MockActionBuilder` class is the core of the testing utilities. It provides a fluent API for configuring mock actions.

#### Constructor

```typescript
const builder = new MockActionBuilder<TInput, TOutput, TUser>();
```

Type parameters:
- `TInput` - The input type for the action
- `TOutput` - The output type for the action
- `TUser` - The user type (if using authentication)

#### Methods

##### `mockSuccess(data: TOutput): this`

Mock a successful action result.

```typescript
builder.mockSuccess({ id: '123', name: 'John' });
```

##### `mockAuthError(message?: string): this`

Mock an authentication error.

```typescript
builder.mockAuthError('User not authenticated');
```

##### `mockInputValidationError(errors: ValidationError[]): this`

Mock input validation errors.

```typescript
builder.mockInputValidationError([
  { field: 'email', constraints: ['must be a valid email'] }
]);
```

##### `mockOutputValidationError(errors: ValidationError[]): this`

Mock output validation errors.

```typescript
builder.mockOutputValidationError([
  { field: 'id', constraints: ['must be a string'] }
]);
```

##### `mockServerError(message: string, cause?: unknown): this`

Mock a server error.

```typescript
builder.mockServerError('Database connection failed', new Error('Timeout'));
```

##### `mockUser(user: TUser): this`

Set the mock user for authenticated actions.

```typescript
builder.mockUser({ id: '123', role: 'admin' });
```

##### `mockImplementation(fn: Function): this`

Provide a custom implementation for the action.

```typescript
builder.mockImplementation(async (input, context) => {
  return createSuccessResult({ doubled: input.value * 2 });
});
```

##### `withDelay(ms: number): this`

Add a delay before the action resolves (useful for simulating network latency).

```typescript
builder.withDelay(100);
```

##### `withHooks(hooks: Partial<HookCallbacks>): this`

Set hook callbacks for testing.

```typescript
const spy = createHookSpy();
builder.withHooks({
  success: [spy.callback]
});
```

##### `build(): Function`

Build and return the mock action function.

```typescript
const mockAction = builder.build();
```

#### Call Tracking Methods

##### `getCallHistory()`

Get the full call history.

```typescript
const history = builder.getCallHistory();
// Returns: Array<{ input, result, timestamp }>
```

##### `getCallCount(): number`

Get the number of times the mock was called.

```typescript
expect(builder.getCallCount()).toBe(3);
```

##### `wasCalled(): boolean`

Check if the mock was called at least once.

```typescript
expect(builder.wasCalled()).toBe(true);
```

##### `wasCalledWith(input: TInput): boolean`

Check if the mock was called with specific input.

```typescript
expect(builder.wasCalledWith({ name: 'Alice' })).toBe(true);
```

##### `getFirstCall()` / `getLastCall()`

Get the first or last call details.

```typescript
const firstCall = builder.getFirstCall();
expect(firstCall?.input.name).toBe('Alice');
```

##### `clearHistory(): void`

Clear the call history.

```typescript
builder.clearHistory();
```

### createMockAction

A convenience function that creates a `MockActionBuilder` instance with optional type inference from an existing action.

```typescript
function createMockAction<TAction>(action?: TAction): MockActionBuilder
```

**Example:**

```typescript
const mockAction = createMockAction(myAction)
  .mockSuccess({ result: 'ok' })
  .build();
```

### Result Creators

Utility functions for creating different types of action results.

#### `createSuccessResult<T>(data: T): ActionResult<T>`

Create a successful result.

```typescript
const result = createSuccessResult({ id: '123', name: 'John' });
```

#### `createAuthErrorResult<T>(message?: string): ActionResult<T>`

Create an authentication error result.

```typescript
const result = createAuthErrorResult('Invalid credentials');
```

#### `createInputErrorResult<T>(errors: ValidationError[], message?: string): ActionResult<T>`

Create an input validation error result.

```typescript
const result = createInputErrorResult([
  createValidationError('email', 'invalid format')
]);
```

#### `createOutputErrorResult<T>(errors: ValidationError[], message?: string): ActionResult<T>`

Create an output validation error result.

```typescript
const result = createOutputErrorResult([
  createValidationError('id', 'must be a string')
]);
```

#### `createServerErrorResult<T>(message: string, cause?: unknown): ActionResult<T>`

Create a server error result.

```typescript
const result = createServerErrorResult('Database error', dbError);
```

#### `createValidationError(field: string, ...constraints: string[]): ValidationError`

Create a validation error object.

```typescript
const error = createValidationError('email', 'must be a valid email', 'is required');
```

### Context Creators

#### `createTestContext<TInput, TUser>(parsedInput: TInput, user?: TUser): ActionContext<TInput, TUser>`

Create a test context for action handlers.

```typescript
const context = createTestContext(
  { name: 'John', email: 'john@example.com' },
  { id: '123', role: 'admin' }
);

const result = await handler(context);
```

#### `createMockAuthHandler<TUser>(user: TUser | null | undefined): AuthHandler<TUser>`

Create a mock authentication handler.

```typescript
const authHandler = createMockAuthHandler({ id: '123', role: 'admin' });
const user = await authHandler(); // Returns the mock user
```

### Hook Spies

The `HookSpy` class helps you test hook callbacks.

```typescript
class HookSpy<TContext> {
  readonly callback: HookCallback<TContext>;
  
  getCalls(): TContext[];
  getCallCount(): number;
  wasCalled(): boolean;
  getFirstCall(): TContext | undefined;
  getLastCall(): TContext | undefined;
  clear(): void;
  wasCalledWith(predicate: (context: TContext) => boolean): boolean;
}
```

**Example:**

```typescript
const spy = createHookSpy();

const mockAction = createMockAction()
  .mockSuccess({ result: 'ok' })
  .withHooks({
    success: [spy.callback]
  })
  .build();

await mockAction({ test: 'data' });

expect(spy.wasCalled()).toBe(true);
expect(spy.getCallCount()).toBe(1);
```

### Wait Utilities

#### `waitFor(condition: () => boolean, options?: { timeout?: number, interval?: number }): Promise<void>`

Wait for a condition to become true.

```typescript
let processing = true;

setTimeout(() => { processing = false; }, 200);

await waitFor(() => !processing, { timeout: 1000, interval: 50 });
```

#### `wait(ms: number): Promise<void>`

Wait for a specific duration.

```typescript
await wait(100); // Wait 100ms
```

#### `createDeferred<T>()`

Create a deferred promise for testing async scenarios.

```typescript
const deferred = createDeferred<string>();

setTimeout(() => {
  deferred.resolve('success');
}, 100);

const result = await deferred.promise; // 'success'
```

## Usage Examples

### Example 1: Testing Successful Actions

```typescript
import { createMockAction } from '@arqetype/next-validated-action/testing';
import { isSuccess } from '@arqetype/next-validated-action';

describe('createUser action', () => {
  it('should create a user successfully', async () => {
    const mockAction = createMockAction()
      .mockSuccess({
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com'
      })
      .build();

    const result = await mockAction({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'securepass123'
    });

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data.id).toBe('user-123');
      expect(result.data.name).toBe('John Doe');
    }
  });
});
```

### Example 2: Testing Validation Errors

```typescript
import { createMockAction, createValidationError } from '@arqetype/next-validated-action/testing';
import { isInputError } from '@arqetype/next-validated-action';

describe('validation errors', () => {
  it('should handle invalid email', async () => {
    const mockAction = createMockAction()
      .mockInputValidationError([
        createValidationError('email', 'must be a valid email')
      ])
      .build();

    const result = await mockAction({
      email: 'invalid-email'
    });

    expect(isInputError(result)).toBe(true);
    if (isInputError(result)) {
      expect(result.details).toHaveLength(1);
      expect(result.details[0].field).toBe('email');
    }
  });
});
```

### Example 3: Testing with Authentication

```typescript
import { createMockAction } from '@arqetype/next-validated-action/testing';
import { isAuthError, isSuccess } from '@arqetype/next-validated-action';

describe('authenticated actions', () => {
  it('should reject unauthenticated users', async () => {
    const mockAction = createMockAction()
      .mockAuthError('Authentication required')
      .build();

    const result = await mockAction({ action: 'delete' });

    expect(isAuthError(result)).toBe(true);
  });

  it('should allow authenticated users', async () => {
    const mockAction = createMockAction()
      .mockUser({ id: '123', role: 'admin' })
      .mockSuccess({ deleted: true })
      .build();

    const result = await mockAction({ action: 'delete' });

    expect(isSuccess(result)).toBe(true);
  });
});
```

### Example 4: Testing with Custom Implementation

```typescript
import { MockActionBuilder, createServerErrorResult, createSuccessResult } from '@arqetype/next-validated-action/testing';

describe('retry scenarios', () => {
  it('should succeed after retries', async () => {
    let attemptCount = 0;

    const builder = new MockActionBuilder()
      .mockImplementation(async (input, context) => {
        attemptCount++;
        
        if (attemptCount <= 2) {
          return createServerErrorResult('Temporary failure');
        }
        
        return createSuccessResult({ success: true, attempts: attemptCount });
      });

    const mockAction = builder.build();

    await mockAction({ test: 'data' }); // Fails
    await mockAction({ test: 'data' }); // Fails
    const result = await mockAction({ test: 'data' }); // Succeeds

    expect(isSuccess(result)).toBe(true);
  });
});
```

### Example 5: Testing Hooks

```typescript
import { createMockAction, createHookSpy } from '@arqetype/next-validated-action/testing';

describe('action hooks', () => {
  it('should trigger success hook', async () => {
    const successSpy = createHookSpy();
    const completeSpy = createHookSpy();

    const mockAction = createMockAction()
      .mockSuccess({ result: 'ok' })
      .withHooks({
        success: [successSpy.callback],
        complete: [completeSpy.callback]
      })
      .build();

    await mockAction({ test: 'data' });

    expect(successSpy.wasCalled()).toBe(true);
    expect(completeSpy.wasCalled()).toBe(true);
    
    const successContext = successSpy.getLastCall();
    expect(successContext?.result.success).toBe(true);
  });
});
```

### Example 6: Tracking Call History

```typescript
import { MockActionBuilder } from '@arqetype/next-validated-action/testing';

describe('call tracking', () => {
  it('should track all calls', async () => {
    const builder = new MockActionBuilder()
      .mockSuccess({ ok: true });
    
    const mockAction = builder.build();

    await mockAction({ user: 'Alice' });
    await mockAction({ user: 'Bob' });
    await mockAction({ user: 'Charlie' });

    expect(builder.getCallCount()).toBe(3);
    expect(builder.wasCalledWith({ user: 'Alice' })).toBe(true);
    expect(builder.wasCalledWith({ user: 'Dave' })).toBe(false);

    const history = builder.getCallHistory();
    expect(history[0].input).toEqual({ user: 'Alice' });
    expect(history[2].input).toEqual({ user: 'Charlie' });
  });
});
```

### Example 7: Simulating Network Delays

```typescript
import { createMockAction } from '@arqetype/next-validated-action/testing';

describe('loading states', () => {
  it('should handle slow responses', async () => {
    const mockAction = createMockAction()
      .mockSuccess({ data: 'loaded' })
      .withDelay(100) // Simulate 100ms network delay
      .build();

    const startTime = Date.now();
    await mockAction({ test: 'data' });
    const duration = Date.now() - startTime;

    expect(duration).toBeGreaterThanOrEqual(100);
  });
});
```

## Best Practices

### 1. Use Type-Safe Mocks

Always specify types for better IDE support and type checking:

```typescript
const builder = new MockActionBuilder<
  CreateUserInput,
  CreateUserOutput,
  User
>();
```

### 2. Test All Error Cases

Don't just test the happy path. Test validation errors, auth errors, and server errors:

```typescript
describe('createUser', () => {
  it('should succeed with valid input', async () => { /* ... */ });
  it('should fail with invalid email', async () => { /* ... */ });
  it('should fail without authentication', async () => { /* ... */ });
  it('should handle database errors', async () => { /* ... */ });
});
```

### 3. Use Hook Spies for Lifecycle Testing

Test that hooks are called at the right time with the right data:

```typescript
const beforeSpy = createHookSpy();
const afterSpy = createHookSpy();

const mockAction = createMockAction()
  .withHooks({
    beforeExecution: [beforeSpy.callback],
    success: [afterSpy.callback]
  })
  .build();

await mockAction({ test: 'data' });

expect(beforeSpy.getCallCount()).toBe(1);
expect(afterSpy.getCallCount()).toBe(1);
```

### 4. Clear State Between Tests

Always clear mock state between tests to avoid test pollution:

```typescript
let builder: MockActionBuilder;

beforeEach(() => {
  builder = new MockActionBuilder();
});

afterEach(() => {
  builder.clearHistory();
});
```

### 5. Use Result Creators for Consistency

Use the provided result creators instead of manually constructing results:

```typescript
// Good
return createSuccessResult({ id: '123' });
return createInputErrorResult([createValidationError('email', 'invalid')]);

// Avoid
return { success: true, data: { id: '123' } };
return { success: false, error: 'input', message: '...', details: [...] };
```

### 6. Test Real Action Integration

While mocks are useful, also test integration with real actions:

```typescript
import { myAction } from './actions';

describe('myAction integration', () => {
  it('should work with real implementation', async () => {
    // Test with actual action, not mock
    const result = await myAction({ test: 'data' });
    expect(isSuccess(result)).toBe(true);
  });
});
```

### 7. Use waitFor for Async Assertions

When testing async behavior, use `waitFor` instead of arbitrary timeouts:

```typescript
// Good
await waitFor(() => mockAction.wasCalled(), { timeout: 1000 });

// Avoid
await wait(500); // Arbitrary delay
```

## Testing Framework Integration

### Jest

The testing utilities work seamlessly with Jest:

```typescript
import { createMockAction } from '@arqetype/next-validated-action/testing';

describe('myAction', () => {
  it('should work', async () => {
    const mockAction = createMockAction().mockSuccess({ ok: true }).build();
    const result = await mockAction({ test: 'data' });
    expect(result).toMatchObject({ success: true, data: { ok: true } });
  });
});
```

### Vitest

Works with Vitest as well:

```typescript
import { describe, it, expect } from 'vitest';
import { createMockAction } from '@arqetype/next-validated-action/testing';

describe('myAction', () => {
  it('should work', async () => {
    const mockAction = createMockAction().mockSuccess({ ok: true }).build();
    const result = await mockAction({ test: 'data' });
    expect(result).toMatchObject({ success: true, data: { ok: true } });
  });
});
```

## Troubleshooting

### Mock Not Called

If your mock doesn't seem to be called:

1. Ensure you called `.build()` to get the function
2. Check that you're using the built function, not the builder
3. Verify async/await is used correctly

```typescript
// Wrong
const mockAction = createMockAction().mockSuccess({ ok: true });
await mockAction({ test: 'data' }); // Error: mockAction is a builder, not a function

// Correct
const mockAction = createMockAction().mockSuccess({ ok: true }).build();
await mockAction({ test: 'data' }); // Works!
```

### Type Errors

If you get type errors with mocks:

1. Specify explicit types on the MockActionBuilder
2. Use type assertions when necessary
3. Ensure your DTOs have proper class-validator decorators

```typescript
const builder = new MockActionBuilder<MyInput, MyOutput, MyUser>();
```

### Hooks Not Firing

If hooks aren't being called:

1. Ensure hooks are registered with `withHooks()`
2. Check that you're using hook spies correctly
3. Verify the action result type matches what triggers the hook

```typescript
// Success hooks only fire on success
const spy = createHookSpy();
const mockAction = createMockAction()
  .mockAuthError() // This won't trigger success hook
  .withHooks({ success: [spy.callback] })
  .build();
```

## Further Reading

- [Main Documentation](../README.md)
- [API Reference](./api-reference.md)
- [Examples](../examples/)