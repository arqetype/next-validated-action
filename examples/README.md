# Examples

This directory contains example usage patterns for `@arqetype/next-validated-action`.

## Available Examples

### [basic-action.ts](./basic-action.ts)

Demonstrates basic input/output validation with a simple sign-up action.

**Features shown:**

- Input DTO with validation decorators
- Output DTO with validation
- Basic action creation

### [with-auth.ts](./with-auth.ts)

Shows how to create authenticated actions that require a logged-in user.

**Features shown:**

- Authentication with `needsAuth()`
- Accessing user context in handler
- Protected action patterns

### [usage-in-component.tsx](./usage-in-component.tsx)

Example of how to use actions in Next.js components.

**Features shown:**

- Calling actions from components
- Handling action results
- Type-safe error handling

## Running Examples

These examples are for demonstration purposes. To use them in your project:

1. Copy the pattern to your Next.js app
2. Adjust imports to match your project structure
3. Implement your own DTOs and business logic

## More Examples

For more advanced examples, see:

- [Advanced Usage Guide](../docs/ADVANCED.md)
- [API Reference](../docs/API.md)

## Example Patterns

### Middleware Example

```typescript
'use server';

import { action } from '@arqetype/next-validated-action';

// Timing middleware
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
    return { success: true };
  });
```

### Retry Example

```typescript
'use server';

import { action } from '@arqetype/next-validated-action';

export const unstableAction = action
  .retry({
    attempts: 3,
    delay: 1000,
    backoff: 'exponential',
  })
  .action(async ({ parsedInput }) => {
    return await callExternalAPI();
  });
```

### Complex Validation

```typescript
'use server';

import { action } from '@arqetype/next-validated-action';
import { IsString, IsEmail, ValidateNested, Type } from 'class-validator';

class AddressDto {
  @IsString()
  street: string;

  @IsString()
  city: string;
}

class UserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}

export const createUserAction = action
  .inputDto(UserDto)
  .action(async ({ parsedInput }) => {
    // All nested objects are validated
    return { userId: '123' };
  });
```

### Error Handling

```typescript
import { myAction } from './actions';
import {
  isSuccess,
  isInputError,
  isServerError,
} from '@arqetype/next-validated-action';

async function handleAction(data: any) {
  const result = await myAction(data);

  if (isSuccess(result)) {
    console.log('Success:', result.data);
  } else if (isInputError(result)) {
    // Handle validation errors
    result.details?.forEach((error) => {
      console.log(`${error.field}: ${error.constraints.join(', ')}`);
    });
  } else if (isServerError(result)) {
    // Handle server errors
    console.error('Server error:', result.message);
  }
}
```

## Contributing

Have a useful example pattern? Please submit a PR!
