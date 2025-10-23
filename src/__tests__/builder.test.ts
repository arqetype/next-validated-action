import 'reflect-metadata';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsNumber,
} from 'class-validator';
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
});
