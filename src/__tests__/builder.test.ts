import 'reflect-metadata';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { action } from '../builder';
import {
  isSuccess,
  isError,
  isInputError,
  isServerError,
  isAuthError,
} from '../guards';

// Test DTOs
class TestInput {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;
}

class TestOutput {
  @IsString()
  id: string;

  @IsString()
  message: string;
}

class PasswordInput {
  @IsString()
  @MinLength(8)
  password: string;
}

class NumericOutput {
  @IsNumber()
  value: number;
}

class AddressDto {
  @IsString()
  @IsNotEmpty()
  street: string;

  @IsString()
  @IsNotEmpty()
  city: string;
}

class UserWithAddressDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}

describe('ActionClientBuilder', () => {
  describe('basic actions', () => {
    it('should execute action without validation', async () => {
      const testAction = action.action(
        async ({ parsedInput: _parsedInput }) => {
          return { result: 'success' };
        }
      );

      const result = await testAction({ test: 'data' });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toEqual({ result: 'success' });
      }
    });

    it('should pass input to handler', async () => {
      const testAction = action.action(async ({ parsedInput }) => {
        return { echo: parsedInput };
      });

      const result = await testAction({ test: 'input' });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect((result.data as any).echo).toEqual({ test: 'input' });
      }
    });
  });

  describe('input validation', () => {
    it('should validate input successfully', async () => {
      const testAction = action
        .inputDto(TestInput)
        .action(async ({ parsedInput }) => {
          return {
            receivedName: parsedInput.name,
            receivedEmail: parsedInput.email,
          };
        });

      const result = await testAction({
        name: 'John Doe',
        email: 'john@example.com',
      });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect((result.data as any).receivedName).toBe('John Doe');
        expect((result.data as any).receivedEmail).toBe('john@example.com');
      }
    });

    it('should fail validation for invalid input', async () => {
      const testAction = action
        .inputDto(TestInput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return { success: true };
        });

      const result = await testAction({
        name: '',
        email: 'not-an-email',
      });

      expect(isError(result)).toBe(true);
      expect(isInputError(result)).toBe(true);
      if (isInputError(result)) {
        expect(result.error).toBe('input');
        expect(result.details).toBeDefined();
        expect(result.details!.length).toBeGreaterThan(0);
      }
    });

    it('should fail validation for missing required fields', async () => {
      const testAction = action
        .inputDto(TestInput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return { success: true };
        });

      const result = await testAction({});

      expect(isInputError(result)).toBe(true);
    });

    it('should validate password length', async () => {
      const testAction = action
        .inputDto(PasswordInput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return { accepted: true };
        });

      const shortPassword = await testAction({ password: 'short' });
      expect(isInputError(shortPassword)).toBe(true);

      const validPassword = await testAction({
        password: 'long_enough_password',
      });
      expect(isSuccess(validPassword)).toBe(true);
    });
  });

  describe('output validation', () => {
    it('should validate output successfully', async () => {
      const testAction = action
        .outputDto(TestOutput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return {
            id: '123',
            message: 'Success',
          };
        });

      const result = await testAction({});

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.id).toBe('123');
        expect(result.data.message).toBe('Success');
      }
    });

    it('should fail validation for invalid output', async () => {
      const testAction = action
        .outputDto(NumericOutput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return {
            value: 'not a number' as any,
          };
        });

      const result = await testAction({});

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toBe('output');
      }
    });

    it('should convert output to plain object', async () => {
      const testAction = action
        .outputDto(TestOutput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return {
            id: '456',
            message: 'Converted',
          };
        });

      const result = await testAction({});

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        // Should be a plain object, not a class instance
        expect(result.data.constructor.name).toBe('Object');
      }
    });
  });

  describe('authentication', () => {
    it('should require authentication when configured', async () => {
      const testAction = action
        .needsAuth(async () => null)
        .action(async ({ parsedInput: _parsedInput, user: _user }) => {
          return { success: true };
        });

      const result = await testAction({});

      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.message).toBe('Authentication required');
      }
    });

    it('should pass user to handler when authenticated', async () => {
      const mockUser = { id: 'user123', email: 'user@example.com' };

      const testAction = action
        .needsAuth(async () => mockUser)
        .action(async ({ parsedInput: _parsedInput, user }) => {
          if (!user) {
            throw new Error('User not authenticated');
          }
          return {
            userId: user.id,
            userEmail: user.email,
          };
        });

      const result = await testAction({});

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect((result.data as any).userId).toBe('user123');
        expect((result.data as any).userEmail).toBe('user@example.com');
      }
    });

    it('should handle auth handler errors', async () => {
      const testAction = action
        .needsAuth(async () => {
          throw new Error('Auth service unavailable');
        })
        .action(async ({ parsedInput: _parsedInput, user: _user }) => {
          return { success: true };
        });

      const result = await testAction({});

      expect(isAuthError(result)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should catch handler errors', async () => {
      const testAction = action.action(
        async ({ parsedInput: _parsedInput }) => {
          throw new Error('Handler error');
        }
      );

      const result = await testAction({});

      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) {
        expect(result.message).toBe('Handler error');
        expect(result.cause).toBeDefined();
      }
    });

    it('should format error messages', async () => {
      const testAction = action.action(
        async ({ parsedInput: _parsedInput }) => {
          throw new Error('Database connection failed');
        }
      );

      const result = await testAction({});

      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) {
        expect(result.message).toContain('Database connection failed');
      }
    });

    it('should handle non-Error throws', async () => {
      const testAction = action.action(
        async ({ parsedInput: _parsedInput }) => {
          throw 'String error';
        }
      );

      const result = await testAction({});

      expect(isServerError(result)).toBe(true);
    });
  });

  describe('middleware', () => {
    it('should execute middleware', async () => {
      const calls: string[] = [];

      const testAction = action
        .use(async (_ctx, next) => {
          calls.push('middleware-before');
          const result = await next();
          calls.push('middleware-after');
          return result;
        })
        .action(async ({ parsedInput: _parsedInput }) => {
          calls.push('handler');
          return { success: true };
        });

      const result = await testAction({});

      expect(isSuccess(result)).toBe(true);
      expect(calls).toEqual([
        'middleware-before',
        'handler',
        'middleware-after',
      ]);
    });

    it('should execute multiple middlewares in order', async () => {
      const calls: string[] = [];

      const testAction = action
        .use(async (_ctx, next) => {
          calls.push('middleware1-before');
          const result = await next();
          calls.push('middleware1-after');
          return result;
        })
        .use(async (_ctx, next) => {
          calls.push('middleware2-before');
          const result = await next();
          calls.push('middleware2-after');
          return result;
        })
        .action(async ({ parsedInput: _parsedInput }) => {
          calls.push('handler');
          return { success: true };
        });

      await testAction({});

      expect(calls).toEqual([
        'middleware1-before',
        'middleware2-before',
        'handler',
        'middleware2-after',
        'middleware1-after',
      ]);
    });

    it('should allow middleware to modify context', async () => {
      let capturedContext: any = null;

      const testAction = action
        .use(async (ctx, next) => {
          capturedContext = ctx;
          return await next();
        })
        .action(async ({ parsedInput: _parsedInput }) => {
          return { success: true };
        });

      await testAction({ test: 'data' });

      expect(capturedContext).toBeDefined();
      expect(capturedContext.parsedInput).toEqual({ test: 'data' });
    });

    it('should allow middleware to short-circuit', async () => {
      let handlerCalled = false;

      const testAction = action
        .use(async (_ctx, _next) => {
          // Short-circuit without calling next
          return {
            success: false,
            error: 'server',
            message: 'Blocked by middleware',
          } as any;
        })
        .action(async ({ parsedInput: _parsedInput }) => {
          handlerCalled = true;
          return { success: true };
        });

      const result = await testAction({});

      expect(handlerCalled).toBe(false);
      expect(isServerError(result)).toBe(true);
    });
  });

  describe('logger', () => {
    it('should call logger during action execution', async () => {
      const logs: Array<{ level: string; message: string }> = [];

      const testAction = action
        .logger((level, message, _meta) => {
          logs.push({ level, message });
        })
        .action(async ({ parsedInput: _parsedInput }) => {
          return { success: true };
        });

      await testAction({});

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((log) => log.message === 'Action started')).toBe(true);
      expect(
        logs.some((log) => log.message === 'Action completed successfully')
      ).toBe(true);
    });

    it('should log validation failures', async () => {
      const logs: Array<{ level: string; message: string }> = [];

      const testAction = action
        .logger((level, message, _meta) => {
          logs.push({ level, message });
        })
        .inputDto(TestInput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return { success: true };
        });

      await testAction({ name: '', email: 'invalid' });

      expect(
        logs.some((log) => log.message === 'Input validation failed')
      ).toBe(true);
    });

    it('should log errors', async () => {
      const logs: Array<{ level: string; message: string }> = [];

      const testAction = action
        .logger((level, message, _meta) => {
          logs.push({ level, message });
        })
        .action(async ({ parsedInput: _parsedInput }) => {
          throw new Error('Test error');
        });

      await testAction({});

      expect(
        logs.some((log) => log.message === 'Handler execution error')
      ).toBe(true);
    });
  });

  describe('retry', () => {
    it('should retry on failure', async () => {
      let attempts = 0;

      const testAction = action
        .retry({ attempts: 3, delay: 10 })
        .action(async ({ parsedInput: _parsedInput }) => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return { success: true, attempts };
        });

      const result = await testAction({});

      expect(isSuccess(result)).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should fail after max attempts', async () => {
      let attempts = 0;

      const testAction = action
        .retry({ attempts: 3, delay: 10 })
        .action(async ({ parsedInput: _parsedInput }) => {
          attempts++;
          throw new Error('Always fails');
        });

      const result = await testAction({});

      expect(isServerError(result)).toBe(true);
      expect(attempts).toBe(3);
    });
  });

  describe('validation options', () => {
    it('should apply custom validation options', async () => {
      const testAction = action
        .inputDto(TestInput)
        .validationOptions({ whitelist: true })
        .action(async ({ parsedInput: _parsedInput }) => {
          return { success: true };
        });

      const result = await testAction({
        name: 'Test',
        email: 'test@example.com',
        extra: 'field',
      });

      expect(isSuccess(result)).toBe(true);
    });
  });

  describe('chaining', () => {
    it('should support method chaining', async () => {
      const mockUser = { id: '123' };

      const testAction = action
        .needsAuth(async () => mockUser)
        .inputDto(TestInput)
        .use(async (_ctx, next) => next())
        .logger((_level, _message) => {})
        .retry({ attempts: 2, delay: 10 })
        .validationOptions({ whitelist: true })
        .action(async ({ parsedInput, user }) => {
          return {
            id: user?.id || 'unknown',
            message: `Hello ${parsedInput.name}`,
          };
        });

      const result = await testAction({
        name: 'John',
        email: 'john@example.com',
      });

      expect(isSuccess(result)).toBe(true);
    });
  });

  describe('complex scenarios', () => {
    it('should handle full validation pipeline', async () => {
      const mockUser = { id: 'user123', role: 'admin' };

      const testAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .needsAuth(async () => mockUser)
        .action(async ({ parsedInput, user }) => {
          return {
            id: `${user?.id || 'unknown'}-${Date.now()}`,
            message: `Welcome ${parsedInput.name}`,
          };
        });

      const result = await testAction({
        name: 'Jane Doe',
        email: 'jane@example.com',
      });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.id).toContain('user123');
        expect(result.data.message).toBe('Welcome Jane Doe');
      }
    });

    it('should fail at first validation error', async () => {
      const testAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return { id: '123', message: 'Should not reach here' };
        });

      const result = await testAction({ name: '', email: 'invalid' });

      expect(isInputError(result)).toBe(true);
    });

    it('should validate output even with valid input', async () => {
      const testAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .action(async ({ parsedInput: _parsedInput }) => {
          // Return invalid output
          return { id: 123, message: '' } as any;
        });

      const result = await testAction({
        name: 'Valid Name',
        email: 'valid@example.com',
      });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toBe('output');
      }
    });
  });

  describe('rate limit metadata', () => {
    it('should store rate limit configuration', () => {
      const builder = action.rateLimit({ maxCalls: 10, windowMs: 60000 });

      expect(builder.getRateLimitConfig()).toEqual({
        maxCalls: 10,
        windowMs: 60000,
      });
    });

    it('should return undefined when not configured', () => {
      expect(action.getRateLimitConfig()).toBeUndefined();
    });
  });

  describe('nested validation', () => {
    it('should validate nested objects successfully', async () => {
      const testAction = action
        .inputDto(UserWithAddressDto)
        .action(async ({ parsedInput }) => {
          return {
            userName: parsedInput.name,
            userCity: parsedInput.address.city,
          };
        });

      const result = await testAction({
        name: 'John Doe',
        address: {
          street: '123 Main St',
          city: 'New York',
        },
      });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect((result.data as any).userName).toBe('John Doe');
        expect((result.data as any).userCity).toBe('New York');
      }
    });

    it('should fail validation for invalid nested objects', async () => {
      const testAction = action
        .inputDto(UserWithAddressDto)
        .action(async ({ parsedInput: _parsedInput }) => {
          return { success: true };
        });

      const result = await testAction({
        name: 'John Doe',
        address: {
          street: '',
          city: '',
        },
      });

      expect(isInputError(result)).toBe(true);
      if (isInputError(result)) {
        expect(result.details).toBeDefined();
        expect(result.details!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('action composition', () => {
    it('should support creating base authenticated actions', async () => {
      const mockUser = { id: 'user123', role: 'user' };

      const authenticatedAction = action.needsAuth(async () => mockUser);

      const profileAction = authenticatedAction
        .inputDto(TestInput)
        .action(async ({ parsedInput, user }) => {
          return {
            userId: user?.id,
            name: parsedInput.name,
          };
        });

      const result = await profileAction({
        name: 'John',
        email: 'john@example.com',
      });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect((result.data as any).userId).toBe('user123');
      }
    });

    it('should support composing actions with middleware', async () => {
      const calls: string[] = [];

      const baseAction = action.use(async (_ctx, next) => {
        calls.push('base-middleware');
        return await next();
      });

      const extendedAction = baseAction
        .use(async (_ctx, next) => {
          calls.push('extended-middleware');
          return await next();
        })
        .action(async ({ parsedInput: _parsedInput }) => {
          calls.push('handler');
          return { success: true };
        });

      await extendedAction({});

      expect(calls).toEqual([
        'base-middleware',
        'extended-middleware',
        'handler',
      ]);
    });
  });

  describe('retry with different error types', () => {
    it('should not retry on input validation errors', async () => {
      let attempts = 0;

      const testAction = action
        .inputDto(TestInput)
        .retry({ attempts: 3, delay: 10 })
        .action(async ({ parsedInput: _parsedInput }) => {
          attempts++;
          return { success: true };
        });

      const result = await testAction({ name: '', email: 'invalid' });

      expect(isInputError(result)).toBe(true);
      expect(attempts).toBe(0); // Handler should not be called
    });

    it('should not retry on auth errors', async () => {
      let attempts = 0;

      const testAction = action
        .needsAuth(async () => null)
        .retry({ attempts: 3, delay: 10 })
        .action(async ({ parsedInput: _parsedInput }) => {
          attempts++;
          return { success: true };
        });

      const result = await testAction({});

      expect(isAuthError(result)).toBe(true);
      expect(attempts).toBe(0); // Handler should not be called
    });

    it('should succeed on second retry attempt', async () => {
      let attempts = 0;

      const testAction = action
        .retry({ attempts: 3, delay: 10 })
        .action(async ({ parsedInput: _parsedInput }) => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Temporary failure');
          }
          return { success: true, attempts };
        });

      const result = await testAction({});

      expect(isSuccess(result)).toBe(true);
      expect(attempts).toBe(2);
    });
  });

  describe('logger metadata', () => {
    it('should pass metadata to logger', async () => {
      const logs: Array<{ level: string; message: string; meta?: any }> = [];

      const testAction = action
        .logger((level, message, meta) => {
          logs.push({ level, message, meta });
        })
        .inputDto(TestInput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return { success: true };
        });

      await testAction({ name: 'Test', email: 'test@example.com' });

      const startLog = logs.find((log) => log.message === 'Action started');
      expect(startLog).toBeDefined();
      expect(startLog?.meta).toBeDefined();
      expect(startLog?.meta?.actionId).toBeDefined();
      expect(startLog?.meta?.hasInput).toBe(true);
    });

    it('should log validation details in metadata', async () => {
      const logs: Array<{ level: string; message: string; meta?: any }> = [];

      const testAction = action
        .logger((level, message, meta) => {
          logs.push({ level, message, meta });
        })
        .inputDto(TestInput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return { success: true };
        });

      await testAction({ name: '', email: 'invalid' });

      const validationLog = logs.find(
        (log) => log.message === 'Input validation failed'
      );
      expect(validationLog).toBeDefined();
      expect(validationLog?.meta?.details).toBeDefined();
    });
  });

  describe('middleware error handling', () => {
    it('should handle errors thrown in middleware', async () => {
      const testAction = action
        .use(async (_ctx, _next) => {
          throw new Error('Middleware error');
        })
        .action(async ({ parsedInput: _parsedInput }) => {
          return { success: true };
        });

      const result = await testAction({});

      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) {
        expect(result.message).toBe('Middleware error');
      }
    });

    it('should handle multiple middlewares with one throwing error', async () => {
      const calls: string[] = [];

      const testAction = action
        .use(async (_ctx, next) => {
          calls.push('middleware1-before');
          try {
            return await next();
          } finally {
            calls.push('middleware1-after');
          }
        })
        .use(async (_ctx, _next) => {
          calls.push('middleware2-error');
          throw new Error('Middleware 2 error');
        })
        .action(async ({ parsedInput: _parsedInput }) => {
          calls.push('handler');
          return { success: true };
        });

      const result = await testAction({});

      expect(isServerError(result)).toBe(true);
      expect(calls).toContain('middleware1-before');
      expect(calls).toContain('middleware2-error');
      expect(calls).not.toContain('handler');
    });
  });

  describe('output validation with instanceToPlain', () => {
    it('should convert class instances to plain objects in output', async () => {
      const testAction = action
        .outputDto(TestOutput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return {
            id: '123',
            message: 'Test',
          };
        });

      const result = await testAction({});

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        // Verify it's a plain object, not a class instance
        expect(Object.getPrototypeOf(result.data)).toBe(Object.prototype);
        expect(result.data.constructor).toBe(Object);
      }
    });
  });

  describe('exponential backoff precision', () => {
    it('should use correct exponential backoff delays', async () => {
      jest.setTimeout(10000);
      let attempts = 0;
      const delays: number[] = [];
      let lastTime = Date.now();

      const testAction = action
        .retry({ attempts: 4, delay: 50, backoff: 'exponential' })
        .action(async ({ parsedInput: _parsedInput }) => {
          const now = Date.now();
          if (attempts > 0) {
            delays.push(now - lastTime);
          }
          lastTime = now;
          attempts++;
          throw new Error('Always fails');
        });

      await testAction({});

      expect(attempts).toBe(4);
      // First retry: 50ms * 2^0 = 50ms
      expect(delays[0]).toBeGreaterThanOrEqual(50);
      expect(delays[0]).toBeLessThan(100);
      // Second retry: 50ms * 2^1 = 100ms
      expect(delays[1]).toBeGreaterThanOrEqual(100);
      expect(delays[1]).toBeLessThan(150);
      // Third retry: 50ms * 2^2 = 200ms
      expect(delays[2]).toBeGreaterThanOrEqual(200);
      expect(delays[2]).toBeLessThan(300);
    });
  });
});
