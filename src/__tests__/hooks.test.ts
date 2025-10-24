import 'reflect-metadata';
import { action } from '../builder';
import { IsString, IsEmail, IsNotEmpty } from 'class-validator';

// ============================================
// Test DTOs
// ============================================

class TestInput {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;
}

class TestOutput {
  @IsString()
  userId: string;

  @IsString()
  message: string;
}

// ============================================
// Tests
// ============================================

describe('Hooks System', () => {
  describe('Lifecycle Hooks', () => {
    describe('beforeValidation hook', () => {
      it('should trigger before input validation', async () => {
        const hookCalls: string[] = [];

        const testAction = action
          .inputDto(TestInput)
          .on('beforeValidation', async (ctx) => {
            hookCalls.push('beforeValidation');
            expect(ctx.rawInput).toBeDefined();
            expect(ctx.actionId).toBeDefined();
            expect(ctx.timestamp).toBeInstanceOf(Date);
          })
          .action(async () => {
            hookCalls.push('action');
            return { success: true };
          });

        await testAction({ name: 'John', email: 'john@example.com' });

        expect(hookCalls).toEqual(['beforeValidation', 'action']);
      });

      it('should receive raw input in context', async () => {
        let capturedContext: any;

        const testAction = action
          .inputDto(TestInput)
          .on('beforeValidation', async (ctx) => {
            capturedContext = ctx;
          })
          .action(async () => ({ success: true }));

        const input = { name: 'John', email: 'john@example.com' };
        await testAction(input);

        expect(capturedContext.rawInput).toEqual(input);
      });
    });

    describe('afterValidation hook', () => {
      it('should trigger after successful input validation', async () => {
        const hookCalls: string[] = [];

        const testAction = action
          .inputDto(TestInput)
          .on('afterValidation', async (ctx) => {
            hookCalls.push('afterValidation');
            expect(ctx.validatedInput).toBeDefined();
            expect(ctx.rawInput).toBeDefined();
          })
          .action(async () => {
            hookCalls.push('action');
            return { success: true };
          });

        await testAction({ name: 'John', email: 'john@example.com' });

        expect(hookCalls).toEqual(['afterValidation', 'action']);
      });

      it('should not trigger on validation failure', async () => {
        let hookCalled = false;

        const testAction = action
          .inputDto(TestInput)
          .on('afterValidation', async () => {
            hookCalled = true;
          })
          .action(async () => ({ success: true }));

        await testAction({ name: '', email: 'invalid' });

        expect(hookCalled).toBe(false);
      });
    });

    describe('beforeExecution hook', () => {
      it('should trigger before handler execution', async () => {
        const hookCalls: string[] = [];

        const testAction = action
          .inputDto(TestInput)
          .on('beforeExecution', async (ctx) => {
            hookCalls.push('beforeExecution');
            expect(ctx.parsedInput).toBeDefined();
          })
          .action(async () => {
            hookCalls.push('action');
            return { success: true };
          });

        await testAction({ name: 'John', email: 'john@example.com' });

        expect(hookCalls).toEqual(['beforeExecution', 'action']);
      });

      it('should receive parsed input in context', async () => {
        let capturedInput: any;

        const testAction = action
          .inputDto(TestInput)
          .on('beforeExecution', async (ctx) => {
            capturedInput = ctx.parsedInput;
          })
          .action(async () => ({ success: true }));

        await testAction({ name: 'John', email: 'john@example.com' });

        expect(capturedInput.name).toBe('John');
        expect(capturedInput.email).toBe('john@example.com');
      });
    });

    describe('afterExecution hook', () => {
      it('should trigger after handler execution', async () => {
        const hookCalls: string[] = [];

        const testAction = action
          .inputDto(TestInput)
          .outputDto(TestOutput)
          .on('afterExecution', async (ctx) => {
            hookCalls.push('afterExecution');
            expect(ctx.rawOutput).toBeDefined();
          })
          .action(async () => {
            hookCalls.push('action');
            return { userId: '123', message: 'Success' };
          });

        await testAction({ name: 'John', email: 'john@example.com' });

        expect(hookCalls).toEqual(['action', 'afterExecution']);
      });

      it('should receive raw output in context', async () => {
        let capturedOutput: any;

        const testAction = action
          .inputDto(TestInput)
          .outputDto(TestOutput)
          .on('afterExecution', async (ctx) => {
            capturedOutput = ctx.rawOutput;
          })
          .action(async () => {
            return { userId: '123', message: 'Success' };
          });

        await testAction({ name: 'John', email: 'john@example.com' });

        expect(capturedOutput.userId).toBe('123');
        expect(capturedOutput.message).toBe('Success');
      });
    });
  });

  describe('Success Hook', () => {
    it('should trigger on successful action', async () => {
      let hookCalled = false;

      const testAction = action
        .inputDto(TestInput)
        .outputDto(TestOutput)
        .on('success', async (ctx) => {
          hookCalled = true;
          expect(ctx.result.success).toBe(true);
          expect(ctx.result.data).toBeDefined();
          expect(ctx.duration).toBeGreaterThanOrEqual(0);
        })
        .action(async () => {
          return { userId: '123', message: 'Success' };
        });

      const result = await testAction({
        name: 'John',
        email: 'john@example.com',
      });

      expect(hookCalled).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should not trigger on error', async () => {
      let hookCalled = false;

      const testAction = action
        .inputDto(TestInput)
        .on('success', async () => {
          hookCalled = true;
        })
        .action(async () => {
          throw new Error('Test error');
        });

      await testAction({ name: 'John', email: 'john@example.com' });

      expect(hookCalled).toBe(false);
    });

    it('should receive result data in context', async () => {
      let capturedData: any;

      const testAction = action
        .outputDto(TestOutput)
        .on('success', async (ctx) => {
          capturedData = ctx.result.data;
        })
        .action(async () => {
          return { userId: '456', message: 'Test' };
        });

      await testAction({});

      expect(capturedData.userId).toBe('456');
      expect(capturedData.message).toBe('Test');
    });
  });

  describe('Error Hooks', () => {
    describe('generic error hook', () => {
      it('should trigger on any error', async () => {
        const errorTypes: string[] = [];

        const testAction = action
          .inputDto(TestInput)
          .on('error', async (ctx) => {
            errorTypes.push(ctx.errorType);
          })
          .action(async () => {
            throw new Error('Test error');
          });

        await testAction({ name: '', email: 'invalid' }); // input error
        await testAction({ name: 'John', email: 'john@example.com' }); // server error

        expect(errorTypes).toContain('input');
        expect(errorTypes).toContain('server');
      });

      it('should receive error message and type', async () => {
        let capturedContext: any;

        const testAction = action
          .on('error', async (ctx) => {
            capturedContext = ctx;
          })
          .action(async () => {
            throw new Error('Custom error');
          });

        await testAction({});

        expect(capturedContext.errorType).toBe('server');
        expect(capturedContext.message).toContain('Custom error');
        expect(capturedContext.error).toBeDefined();
      });
    });

    describe('authError hook', () => {
      it('should trigger on authentication failure', async () => {
        let hookCalled = false;

        const testAction = action
          .needsAuth(async () => null)
          .on('authError', async (ctx) => {
            hookCalled = true;
            expect(ctx.message).toBeDefined();
          })
          .action(async () => {
            return { success: true };
          });

        const result = await testAction({});

        expect(hookCalled).toBe(true);
        expect(result.success).toBe(false);
      });

      it('should trigger when auth handler throws', async () => {
        let hookCalled = false;

        const testAction = action
          .needsAuth(async () => {
            throw new Error('Auth error');
          })
          .on('authError', async (ctx) => {
            hookCalled = true;
            expect(ctx.error).toBeDefined();
          })
          .action(async () => {
            return { success: true };
          });

        await testAction({});

        expect(hookCalled).toBe(true);
      });
    });

    describe('inputValidationError hook', () => {
      it('should trigger on input validation failure', async () => {
        let hookCalled = false;

        const testAction = action
          .inputDto(TestInput)
          .on('inputValidationError', async (ctx) => {
            hookCalled = true;
            expect(ctx.details).toBeDefined();
            expect(ctx.details.length).toBeGreaterThan(0);
            expect(ctx.rawInput).toBeDefined();
          })
          .action(async () => {
            return { success: true };
          });

        await testAction({ name: '', email: 'invalid' });

        expect(hookCalled).toBe(true);
      });

      it('should receive validation details', async () => {
        let capturedDetails: any;

        const testAction = action
          .inputDto(TestInput)
          .on('inputValidationError', async (ctx) => {
            capturedDetails = ctx.details;
          })
          .action(async () => {
            return { success: true };
          });

        await testAction({ name: '', email: 'not-an-email' });

        expect(capturedDetails).toBeDefined();
        expect(Array.isArray(capturedDetails)).toBe(true);
        expect(capturedDetails.length).toBeGreaterThan(0);
      });
    });

    describe('outputValidationError hook', () => {
      it('should trigger on output validation failure', async () => {
        let hookCalled = false;

        const testAction = action
          .outputDto(TestOutput)
          .on('outputValidationError', async (ctx) => {
            hookCalled = true;
            expect(ctx.details).toBeDefined();
            expect(ctx.rawOutput).toBeDefined();
          })
          .action(async () => {
            return { invalidField: 'wrong' } as any;
          });

        await testAction({});

        expect(hookCalled).toBe(true);
      });
    });

    describe('serverError hook', () => {
      it('should trigger on handler errors', async () => {
        let hookCalled = false;

        const testAction = action
          .on('serverError', async (ctx) => {
            hookCalled = true;
            expect(ctx.message).toBeDefined();
            expect(ctx.cause).toBeDefined();
          })
          .action(async () => {
            throw new Error('Handler error');
          });

        await testAction({});

        expect(hookCalled).toBe(true);
      });

      it('should receive error cause', async () => {
        const errorMessage = 'Specific error';
        let capturedCause: any;

        const testAction = action
          .on('serverError', async (ctx) => {
            capturedCause = ctx.cause;
          })
          .action(async () => {
            throw new Error(errorMessage);
          });

        await testAction({});

        expect(capturedCause).toBeInstanceOf(Error);
        expect((capturedCause as Error).message).toBe(errorMessage);
      });
    });
  });

  describe('Retry Hook', () => {
    it('should trigger on each retry attempt', async () => {
      const retryAttempts: number[] = [];

      const testAction = action
        .retry({ attempts: 3, delay: 10, backoff: 'linear' })
        .on('retry', async (ctx) => {
          retryAttempts.push(ctx.attempt);
          expect(ctx.maxAttempts).toBe(3);
          expect(ctx.delay).toBeGreaterThan(0);
        })
        .action(async () => {
          throw new Error('Always fails');
        });

      await testAction({});

      expect(retryAttempts.length).toBeGreaterThan(0);
    });

    it('should provide retry context', async () => {
      let capturedContext: any;

      const testAction = action
        .retry({ attempts: 2, delay: 5, backoff: 'exponential' })
        .on('retry', async (ctx) => {
          if (!capturedContext) {
            capturedContext = ctx;
          }
        })
        .action(async () => {
          throw new Error('Retry test');
        });

      await testAction({});

      expect(capturedContext).toBeDefined();
      expect(capturedContext.attempt).toBeGreaterThan(1);
      expect(capturedContext.maxAttempts).toBe(2);
    });

    it('should not trigger if action succeeds on first attempt', async () => {
      let hookCalled = false;

      const testAction = action
        .retry({ attempts: 3, delay: 10 })
        .on('retry', async () => {
          hookCalled = true;
        })
        .action(async () => {
          return { success: true };
        });

      await testAction({});

      expect(hookCalled).toBe(false);
    });
  });

  describe('Complete Hook', () => {
    it('should always trigger on action completion', async () => {
      let hookCalled = 0;

      const testAction = action
        .on('complete', async (ctx) => {
          hookCalled++;
          expect(ctx.duration).toBeGreaterThanOrEqual(0);
          expect(ctx.result).toBeDefined();
        })
        .action(async () => {
          return { success: true };
        });

      await testAction({});
      await testAction({});

      expect(hookCalled).toBe(2);
    });

    it('should trigger even on errors', async () => {
      let hookCalled = false;

      const testAction = action
        .on('complete', async (ctx) => {
          hookCalled = true;
          expect(ctx.result.success).toBe(false);
        })
        .action(async () => {
          throw new Error('Test error');
        });

      await testAction({});

      expect(hookCalled).toBe(true);
    });

    it('should provide both success and failure results', async () => {
      const results: boolean[] = [];

      const testAction = action
        .on('complete', async (ctx) => {
          results.push(ctx.result.success);
        })
        .action(async ({ parsedInput }: any) => {
          if (parsedInput.shouldFail) {
            throw new Error('Intentional failure');
          }
          return { success: true };
        });

      await testAction({ shouldFail: false });
      await testAction({ shouldFail: true });

      expect(results).toEqual([true, false]);
    });
  });

  describe('Multiple Hooks', () => {
    it('should allow multiple hooks of the same type', async () => {
      const calls: string[] = [];

      const testAction = action
        .on('success', async () => {
          calls.push('first');
        })
        .on('success', async () => {
          calls.push('second');
        })
        .on('success', async () => {
          calls.push('third');
        })
        .action(async () => {
          return { success: true };
        });

      await testAction({});

      expect(calls).toEqual(['first', 'second', 'third']);
    });

    it('should execute hooks in registration order', async () => {
      const order: number[] = [];

      const testAction = action
        .on('complete', async () => {
          order.push(1);
        })
        .on('complete', async () => {
          order.push(2);
        })
        .on('complete', async () => {
          order.push(3);
        })
        .action(async () => {
          return { success: true };
        });

      await testAction({});

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('Hook Error Handling', () => {
    it('should not break action flow if hook throws', async () => {
      const testAction = action
        .on('success', async () => {
          throw new Error('Hook error');
        })
        .action(async () => {
          return { success: true };
        });

      const result = await testAction({});

      expect(result.success).toBe(true);
    });

    it('should continue executing other hooks if one fails', async () => {
      const calls: string[] = [];

      const testAction = action
        .on('success', async () => {
          calls.push('first');
          throw new Error('First hook error');
        })
        .on('success', async () => {
          calls.push('second');
        })
        .on('success', async () => {
          calls.push('third');
        })
        .action(async () => {
          return { success: true };
        });

      await testAction({});

      expect(calls).toEqual(['first', 'second', 'third']);
    });
  });

  describe('Async Hooks', () => {
    it('should handle async hooks correctly', async () => {
      let asyncComplete = false;

      const testAction = action
        .on('success', async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          asyncComplete = true;
        })
        .action(async () => {
          return { success: true };
        });

      await testAction({});

      expect(asyncComplete).toBe(true);
    });

    it('should await all async hooks before continuing', async () => {
      const timing: string[] = [];

      const testAction = action
        .on('complete', async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          timing.push('hook1');
        })
        .on('complete', async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          timing.push('hook2');
        })
        .action(async () => {
          return { success: true };
        });

      await testAction({});
      timing.push('after');

      expect(timing).toEqual(['hook1', 'hook2', 'after']);
    });
  });

  describe('Hooks with Authentication', () => {
    it('should pass user to hooks when authenticated', async () => {
      let capturedUser: any;

      const testAction = action
        .needsAuth(async () => ({ id: '123', name: 'John' }))
        .on('success', async (ctx) => {
          capturedUser = ctx.user;
        })
        .action(async () => {
          return { success: true };
        });

      await testAction({});

      expect(capturedUser).toEqual({ id: '123', name: 'John' });
    });
  });

  describe('Hook Context Data', () => {
    it('should provide actionId in all hooks', async () => {
      const actionIds = new Set<string>();

      const testAction = action
        .on('beforeValidation', async (ctx) => {
          actionIds.add(ctx.actionId);
        })
        .on('complete', async (ctx) => {
          actionIds.add(ctx.actionId);
        })
        .action(async () => {
          return { success: true };
        });

      await testAction({});

      expect(actionIds.size).toBe(1);
      expect(Array.from(actionIds)[0]).toBeDefined();
    });

    it('should provide timestamp in all hooks', async () => {
      let timestamp: Date | undefined;

      const testAction = action
        .on('complete', async (ctx) => {
          timestamp = ctx.timestamp;
        })
        .action(async () => {
          return { success: true };
        });

      await testAction({});

      expect(timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Integration with Other Features', () => {
    it('should work with middleware', async () => {
      const calls: string[] = [];

      const testAction = action
        .use(async (ctx, next) => {
          calls.push('middleware-before');
          const result = await next();
          calls.push('middleware-after');
          return result;
        })
        .on('beforeExecution', async () => {
          calls.push('hook');
        })
        .action(async () => {
          calls.push('action');
          return { success: true };
        });

      await testAction({});

      expect(calls).toContain('middleware-before');
      expect(calls).toContain('hook');
      expect(calls).toContain('action');
      expect(calls).toContain('middleware-after');
    });

    it('should work with logger', async () => {
      const logs: string[] = [];
      let hookCalled = false;

      const testAction = action
        .logger((level, message) => {
          logs.push(`${level}: ${message}`);
        })
        .on('success', async () => {
          hookCalled = true;
        })
        .action(async () => {
          return { success: true };
        });

      await testAction({});

      expect(hookCalled).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });
  });
});
