# Getting Started with @arqetype/next-validated-action

Welcome! This guide will help you get up and running with `@arqetype/next-validated-action` in just a few minutes.

## 📦 Installation

First, install the package and its peer dependencies:

```bash
npm install @arqetype/next-validated-action class-validator class-transformer reflect-metadata
```

## 🚀 Your First Action

### Step 1: Create a DTO (Data Transfer Object)

Create a file `actions/sign-up.ts`:

```typescript
'use server';

import { IsString, IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { action } from '@arqetype/next-validated-action';

// Input validation
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

// Output validation (optional but recommended)
class SignUpOutput {
  @IsString()
  userId: string;

  @IsString()
  message: string;
}
```

### Step 2: Create the Action

In the same file:

```typescript
export const signUpAction = action
  .inputDto(SignUpInput)
  .outputDto(SignUpOutput)
  .action(async ({ parsedInput }) => {
    // Your business logic here
    const user = await createUserInDatabase({
      name: parsedInput.name,
      email: parsedInput.email,
      password: parsedInput.password,
    });

    return {
      userId: user.id,
      message: 'User created successfully',
    };
  });

// Mock function for example
async function createUserInDatabase(data: any) {
  return { id: '123' };
}
```

### Step 3: Use in a Component

Create a component `components/SignUpForm.tsx`:

```typescript
'use client';

import { signUpAction } from '@/actions/sign-up';
import { isSuccess, isInputError } from '@arqetype/next-validated-action';
import { useState } from 'react';

export function SignUpForm() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(formData: FormData) {
    const result = await signUpAction({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
    });

    if (isSuccess(result)) {
      setSuccess(result.data.message);
      setError('');
    } else if (isInputError(result)) {
      // Show validation errors
      const errors = result.details?.map(d =>
        `${d.field}: ${d.constraints.join(', ')}`
      ).join('\n');
      setError(errors || result.message);
      setSuccess('');
    } else {
      setError(result.message);
      setSuccess('');
    }
  }

  return (
    <form action={handleSubmit}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit">Sign Up</button>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
    </form>
  );
}
```

## ✅ That's It!

You now have:

- ✅ Type-safe server actions
- ✅ Automatic input validation
- ✅ Automatic output validation
- ✅ Detailed error handling
- ✅ Full TypeScript support

## 🎯 Next Steps

### Add Authentication

```typescript
async function getCurrentUser() {
  const session = await getServerSession();
  return session?.user || null;
}

export const updateProfileAction = action
  .inputDto(UpdateProfileInput)
  .needsAuth(getCurrentUser) // ⭐ Require authentication
  .action(async ({ parsedInput, user }) => {
    // user is guaranteed to exist here
    await updateUserProfile(user.id, parsedInput);
    return { success: true };
  });
```

### Add Middleware

```typescript
const timingMiddleware = async (ctx, next) => {
  const start = Date.now();
  const result = await next();
  console.log(`Action took ${Date.now() - start}ms`);
  return result;
};

export const myAction = action
  .use(timingMiddleware) // ⭐ Add middleware
  .inputDto(MyInput)
  .action(async ({ parsedInput }) => {
    return { success: true };
  });
```

### Add Retry Logic

```typescript
export const unstableAction = action
  .retry({
    // ⭐ Auto-retry on failure
    attempts: 3,
    delay: 1000,
    backoff: 'exponential',
  })
  .action(async ({ parsedInput }) => {
    return await callExternalAPI();
  });
```

### Add Logging

```typescript
export const myAction = action
  .logger((level, message, meta) => {
    // ⭐ Add logging
    console.log(`[${level}] ${message}`, meta);
  })
  .inputDto(MyInput)
  .action(async ({ parsedInput }) => {
    return { success: true };
  });
```

## 📚 Learn More

- [Complete API Reference](./docs/API.md)
- [Advanced Usage Guide](./docs/ADVANCED.md)
- [Examples](./examples)
- [Contributing](./CONTRIBUTING.md)

## 💡 Common Patterns

### Handle All Error Types

```typescript
import {
  isSuccess,
  isInputError,
  isServerError,
  isAuthError,
} from '@arqetype/next-validated-action';

const result = await myAction(data);

if (isSuccess(result)) {
  console.log('Success:', result.data);
} else if (isInputError(result)) {
  console.error('Validation errors:', result.details);
} else if (isAuthError(result)) {
  redirect('/login');
} else if (isServerError(result)) {
  console.error('Server error:', result.message);
}
```

### Unwrap Results

```typescript
import { unwrap, unwrapOr } from '@arqetype/next-validated-action';

// Throw on error
try {
  const data = unwrap(await myAction(input));
  console.log(data);
} catch (error) {
  console.error(error);
}

// Use default value
const data = unwrapOr(await myAction(input), { default: true });
```

### Compose Actions

```typescript
// Create base action with common config
const authenticatedAction = action
  .needsAuth(getCurrentUser)
  .logger(customLogger);

// Extend it
export const updateSettings = authenticatedAction
  .inputDto(UpdateSettingsDto)
  .action(async ({ parsedInput, user }) => {
    // Automatically authenticated + logged
  });
```

## 🆘 Getting Help

- 📖 Read the [API Reference](./docs/API.md)
- 💬 Open a [GitHub Discussion](https://github.com/your-username/@arqetype/next-validated-action/discussions)
- 🐛 Report a [Bug](https://github.com/your-username/@arqetype/next-validated-action/issues)
- ⭐ Star the project on [GitHub](https://github.com/your-username/@arqetype/next-validated-action)

## 🎉 You're Ready!

Start building type-safe server actions with confidence!

---

**Happy coding! 🚀**
