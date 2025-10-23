import { IsString, IsNumber, Min } from 'class-validator';
import { action } from '../builder';
import { resetAllThrottles } from '../throttle';

class TestInput {
  @IsString()
  message!: string;

  @IsNumber()
  @Min(1)
  value!: number;
}

class TestOutput {
  @IsString()
  result!: string;
}

describe('Throttle Integration Tests', () => {
  beforeEach(() => {
    resetAllThrottles();
  });

  describe('Basic Throttle Functionality', () => {
    it('should allow calls within throttle limit', async () => {
      const throttledAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .throttle({
          maxCalls: 3,
          windowMs: 1000,
          strategy: 'fixed',
        })
        .action(async ({ parsedInput }) => {
          return {
            result: `Processed: ${parsedInput.message}`,
          };
        });

      const result1 = await throttledAction({
        message: 'test1',
        value: 1,
      });
      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.data.result).toBe('Processed: test1');
      }

      const result2 = await throttledAction({
        message: 'test2',
        value: 2,
      });
      expect(result2.success).toBe(true);

      const result3 = await throttledAction({
        message: 'test3',
        value: 3,
      });
      expect(result3.success).toBe(true);
    });

    it('should block calls exceeding throttle limit', async () => {
      const throttledAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .throttle({
          maxCalls: 2,
          windowMs: 1000,
          strategy: 'fixed',
        })
        .action(async ({ parsedInput }) => {
          return {
            result: `Processed: ${parsedInput.message}`,
          };
        });

      const result1 = await throttledAction({
        message: 'test1',
        value: 1,
      });
      expect(result1.success).toBe(true);

      const result2 = await throttledAction({
        message: 'test2',
        value: 2,
      });
      expect(result2.success).toBe(true);

      const result3 = await throttledAction({
        message: 'test3',
        value: 3,
      });
      expect(result3.success).toBe(false);
      if (!result3.success) {
        expect(result3.error).toBe('server');
        expect(result3.message).toContain('Too many requests');
        expect(result3.message).toContain('Limit: 2');
      }
    });

    it('should allow calls after window expires', async () => {
      const throttledAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .throttle({
          maxCalls: 1,
          windowMs: 100,
          strategy: 'fixed',
        })
        .action(async ({ parsedInput }) => {
          return {
            result: `Processed: ${parsedInput.message}`,
          };
        });

      const result1 = await throttledAction({
        message: 'test1',
        value: 1,
      });
      expect(result1.success).toBe(true);

      const result2 = await throttledAction({
        message: 'test2',
        value: 2,
      });
      expect(result2.success).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result3 = await throttledAction({
        message: 'test3',
        value: 3,
      });
      expect(result3.success).toBe(true);
    });
  });

  describe('Sliding Window Strategy', () => {
    it('should use sliding window when configured', async () => {
      const throttledAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .throttle({
          maxCalls: 2,
          windowMs: 100,
          strategy: 'sliding',
        })
        .action(async ({ parsedInput }) => {
          return {
            result: `Processed: ${parsedInput.message}`,
          };
        });

      const result1 = await throttledAction({
        message: 'test1',
        value: 1,
      });
      expect(result1.success).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const result2 = await throttledAction({
        message: 'test2',
        value: 2,
      });
      expect(result2.success).toBe(true);

      const result3 = await throttledAction({
        message: 'test3',
        value: 3,
      });
      expect(result3.success).toBe(false);

      // Wait for first call to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      const result4 = await throttledAction({
        message: 'test4',
        value: 4,
      });
      expect(result4.success).toBe(true);
    });
  });

  describe('Custom Identifier', () => {
    it('should throttle per user when identifier is provided', async () => {
      const throttledAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .needsAuth(async () => {
          return { id: 'user1', name: 'Test User' };
        })
        .throttle({
          maxCalls: 1,
          windowMs: 1000,
          strategy: 'fixed',
          identifier: (ctx) => ctx.user?.id || 'anonymous',
        })
        .action(async ({ parsedInput, user }) => {
          return {
            result: `Processed: ${parsedInput.message} for ${user?.name}`,
          };
        });

      const result1 = await throttledAction({
        message: 'test1',
        value: 1,
      });
      expect(result1.success).toBe(true);

      const result2 = await throttledAction({
        message: 'test2',
        value: 2,
      });
      expect(result2.success).toBe(false);
    });

    it('should throttle based on input when identifier uses input', async () => {
      const throttledAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .throttle({
          maxCalls: 1,
          windowMs: 1000,
          strategy: 'fixed',
          identifier: (ctx) => ctx.parsedInput?.message || 'default',
        })
        .action(async ({ parsedInput }) => {
          return {
            result: `Processed: ${parsedInput.message}`,
          };
        });

      // Different messages should have separate throttle limits
      const result1 = await throttledAction({
        message: 'message1',
        value: 1,
      });
      expect(result1.success).toBe(true);

      const result2 = await throttledAction({
        message: 'message2',
        value: 2,
      });
      expect(result2.success).toBe(true);

      // Same message should be throttled
      const result3 = await throttledAction({
        message: 'message1',
        value: 3,
      });
      expect(result3.success).toBe(false);

      // Different message still works
      const result4 = await throttledAction({
        message: 'message3',
        value: 4,
      });
      expect(result4.success).toBe(true);
    });
  });

  describe('Throttle with Other Features', () => {
    it('should work with input validation', async () => {
      const throttledAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .throttle({
          maxCalls: 2,
          windowMs: 1000,
          strategy: 'fixed',
        })
        .action(async ({ parsedInput }) => {
          return {
            result: `Processed: ${parsedInput.message}`,
          };
        });

      // Invalid input should fail validation before throttle
      const result1 = await throttledAction({
        message: 'test',
        value: 0, // Min is 1
      });
      expect(result1.success).toBe(false);
      if (!result1.success) {
        expect(result1.error).toBe('input');
      }

      // Valid inputs should be throttled
      const result2 = await throttledAction({
        message: 'test',
        value: 1,
      });
      expect(result2.success).toBe(true);

      const result3 = await throttledAction({
        message: 'test',
        value: 2,
      });
      expect(result3.success).toBe(true);

      const result4 = await throttledAction({
        message: 'test',
        value: 3,
      });
      expect(result4.success).toBe(false);
      if (!result4.success) {
        expect(result4.error).toBe('server');
        expect(result4.message).toContain('Too many requests');
      }
    });

    it('should work with authentication', async () => {
      let shouldAuthenticate = true;

      const throttledAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .needsAuth(async () => {
          if (!shouldAuthenticate) return null;
          return { id: 'user1', name: 'Test User' };
        })
        .throttle({
          maxCalls: 2,
          windowMs: 1000,
          strategy: 'fixed',
        })
        .action(async ({ parsedInput }) => {
          return {
            result: `Processed: ${parsedInput.message}`,
          };
        });

      // Authenticated calls should be throttled
      const result1 = await throttledAction({
        message: 'test1',
        value: 1,
      });
      expect(result1.success).toBe(true);

      const result2 = await throttledAction({
        message: 'test2',
        value: 2,
      });
      expect(result2.success).toBe(true);

      const result3 = await throttledAction({
        message: 'test3',
        value: 3,
      });
      expect(result3.success).toBe(false);

      // Unauthenticated call should fail auth before throttle
      shouldAuthenticate = false;
      const result4 = await throttledAction({
        message: 'test4',
        value: 4,
      });
      expect(result4.success).toBe(false);
      if (!result4.success) {
        expect(result4.error).toBe('auth');
      }
    });

    it('should work with middleware', async () => {
      let middlewareCalls = 0;

      const throttledAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .use(async (ctx, next) => {
          middlewareCalls++;
          return await next();
        })
        .throttle({
          maxCalls: 2,
          windowMs: 1000,
          strategy: 'fixed',
        })
        .action(async ({ parsedInput }) => {
          return {
            result: `Processed: ${parsedInput.message}`,
          };
        });

      await throttledAction({ message: 'test1', value: 1 });
      expect(middlewareCalls).toBe(1);

      await throttledAction({ message: 'test2', value: 2 });
      expect(middlewareCalls).toBe(2);

      // This should be throttled before middleware runs
      await throttledAction({ message: 'test3', value: 3 });
      expect(middlewareCalls).toBe(2); // Middleware not called for throttled request
    });

    it('should work with retry', async () => {
      let attempts = 0;

      const throttledAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .retry({
          attempts: 3,
          delay: 10,
          backoff: 'linear',
        })
        .throttle({
          maxCalls: 1,
          windowMs: 10000, // Longer window to ensure test stability
          strategy: 'fixed',
        })
        .action(async ({ parsedInput }) => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Temporary error');
          }
          return {
            result: `Processed: ${parsedInput.message}`,
          };
        });

      const result1 = await throttledAction({
        message: 'test1',
        value: 1,
      });
      expect(result1.success).toBe(true);
      expect(attempts).toBe(2); // Failed once, succeeded on retry

      // Reset attempts
      attempts = 0;

      // Second call should be throttled (window hasn't expired yet)
      const result2 = await throttledAction({
        message: 'test2',
        value: 2,
      });

      // The second call is throttled because we already made 1 call in the window
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error).toBe('server');
        expect(result2.message).toContain('Too many requests');
      }
      expect(attempts).toBe(0); // Throttled before execution
    });

    it('should work with cache', async () => {
      let executionCount = 0;

      const throttledAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .cache({
          ttl: 1000,
        })
        .throttle({
          maxCalls: 2,
          windowMs: 1000,
          strategy: 'fixed',
        })
        .action(async ({ parsedInput }) => {
          executionCount++;
          return {
            result: `Processed: ${parsedInput.message}`,
          };
        });

      // First call - executes and caches
      const result1 = await throttledAction({
        message: 'test1',
        value: 1,
      });
      expect(result1.success).toBe(true);
      expect(executionCount).toBe(1);

      // Second call with same input - returns from cache, doesn't count against throttle
      const result2 = await throttledAction({
        message: 'test1',
        value: 1,
      });
      expect(result2.success).toBe(true);
      expect(executionCount).toBe(1); // Not executed again

      // Third call with different input - executes
      const result3 = await throttledAction({
        message: 'test2',
        value: 2,
      });
      expect(result3.success).toBe(true);
      expect(executionCount).toBe(2);

      // Fourth call - should be throttled
      const result4 = await throttledAction({
        message: 'test3',
        value: 3,
      });
      expect(result4.success).toBe(false);
      expect(executionCount).toBe(2);
    });
  });

  describe('Error Messages', () => {
    it('should provide informative error messages', async () => {
      const throttledAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .throttle({
          maxCalls: 1,
          windowMs: 5000,
          strategy: 'fixed',
        })
        .action(async ({ parsedInput }) => {
          return {
            result: `Processed: ${parsedInput.message}`,
          };
        });

      await throttledAction({ message: 'test1', value: 1 });

      const result = await throttledAction({ message: 'test2', value: 2 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.message).toContain('Too many requests');
        expect(result.message).toContain('Limit: 1');
        expect(result.message).toContain('5000ms');
        expect(result.message).toMatch(/Try again in \d+s/);
      }
    });
  });

  describe('Global Throttle', () => {
    it('should throttle globally when no identifier is provided', async () => {
      const throttledAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .throttle({
          maxCalls: 2,
          windowMs: 1000,
          strategy: 'fixed',
        })
        .action(async ({ parsedInput }) => {
          return {
            result: `Processed: ${parsedInput.message}`,
          };
        });

      const result1 = await throttledAction({
        message: 'test1',
        value: 1,
      });
      expect(result1.success).toBe(true);

      const result2 = await throttledAction({
        message: 'test2',
        value: 2,
      });
      expect(result2.success).toBe(true);

      const result3 = await throttledAction({
        message: 'test3',
        value: 3,
      });
      expect(result3.success).toBe(false);
    });
  });
});
