import 'reflect-metadata';
import { IsString, IsEmail, IsNotEmpty } from 'class-validator';
import {
  createMockAction,
  createTestContext,
  createMockAuthHandler,
  createSuccessResult,
  createAuthErrorResult,
  createInputErrorResult,
  createOutputErrorResult,
  createServerErrorResult,
  createValidationError,
  createHookSpy,
  waitFor,
  wait,
  createDeferred,
  MockActionBuilder,
} from '../testing';
import {
  isSuccess,
  isAuthError,
  isInputError,
  isServerError,
  isOutputError,
} from '../guards';
import type {
  AuthErrorContext,
  ErrorContext,
  InputValidationErrorContext,
} from '../types';

// Test DTOs
class CreateUserInput {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;
}

class CreateUserOutput {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;
}

describe('Testing Utilities', () => {
  describe('createMockAction', () => {
    it('should create a mock action with success result', async () => {
      const builder = new MockActionBuilder<
        { name: string },
        { userId: string },
        unknown
      >().mockSuccess({ userId: '123' });
      const mockAction = builder.build();

      const result = await mockAction({ name: 'John' });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toEqual({ userId: '123' });
      }
    });

    it('should create a mock action with auth error', async () => {
      const mockAction = createMockAction()
        .mockAuthError('User not authenticated')
        .build();

      const result = await mockAction({ test: 'data' });

      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.message).toBe('User not authenticated');
      }
    });

    it('should create a mock action with input validation error', async () => {
      const errors = [
        createValidationError('email', 'must be a valid email'),
        createValidationError('name', 'should not be empty'),
      ];

      const mockAction = createMockAction()
        .mockInputValidationError(errors)
        .build();

      const result = await mockAction({ email: 'invalid', name: '' });

      expect(isInputError(result)).toBe(true);
      if (isInputError(result)) {
        expect(result.details).toEqual(errors);
        expect(result.message).toContain('email');
        expect(result.message).toContain('name');
      }
    });

    it('should create a mock action with output validation error', async () => {
      const errors = [createValidationError('id', 'must be a string')];

      const mockAction = createMockAction()
        .mockOutputValidationError(errors)
        .build();

      const result = await mockAction({ test: 'data' });

      expect(isOutputError(result)).toBe(true);
      if (isOutputError(result)) {
        expect(result.details).toEqual(errors);
      }
    });

    it('should create a mock action with server error', async () => {
      const mockAction = createMockAction()
        .mockServerError(
          'Database connection failed',
          new Error('Connection timeout')
        )
        .build();

      const result = await mockAction({ test: 'data' });

      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) {
        expect(result.message).toBe('Database connection failed');
        expect(result.cause).toBeInstanceOf(Error);
      }
    });

    it('should create a mock action with user context', async () => {
      const user = { id: '123', role: 'admin' };
      let capturedUser: any;

      const mockAction = createMockAction()
        .mockUser(user)
        .mockImplementation(async (_input, context) => {
          capturedUser = context.user;
          return createSuccessResult({ success: true });
        })
        .build();

      await mockAction({ test: 'data' });

      expect(capturedUser).toEqual(user);
    });

    it('should create a mock action with custom implementation', async () => {
      const builder = new MockActionBuilder<
        { value: number },
        { doubled: number },
        unknown
      >().mockImplementation(async (input, _context) => {
        return createSuccessResult({ doubled: (input?.value || 0) * 2 });
      });
      const mockAction = builder.build();

      const result = await mockAction({ value: 5 });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect((result.data as { doubled: number }).doubled).toBe(10);
      }
    });

    it('should create a mock action with delay', async () => {
      const mockAction = createMockAction()
        .mockSuccess({ result: 'ok' })
        .withDelay(100)
        .build();

      const startTime = Date.now();
      await mockAction({ test: 'data' });
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(95); // Allow some margin
    });

    it('should track call history', async () => {
      const builder = new MockActionBuilder<
        { name: string },
        { id: string },
        unknown
      >().mockSuccess({ id: '123' });

      const mockAction = builder.build();

      await mockAction({ name: 'Alice' });
      await mockAction({ name: 'Bob' });

      const history = builder.getCallHistory();
      expect(history).toHaveLength(2);
      expect(history[0].input).toEqual({ name: 'Alice' });
      expect(history[1].input).toEqual({ name: 'Bob' });
    });

    it('should provide call count', async () => {
      const builder = new MockActionBuilder().mockSuccess({ ok: true });
      const mockAction = builder.build();

      expect(builder.getCallCount()).toBe(0);
      expect(builder.wasCalled()).toBe(false);

      await mockAction({ test: 'data' });
      expect(builder.getCallCount()).toBe(1);
      expect(builder.wasCalled()).toBe(true);

      await mockAction({ test: 'data2' });
      expect(builder.getCallCount()).toBe(2);
    });

    it('should check if called with specific input', async () => {
      const builder = new MockActionBuilder().mockSuccess({ ok: true });
      const mockAction = builder.build();

      await mockAction({ name: 'Alice' });
      await mockAction({ name: 'Bob' });

      expect(builder.wasCalledWith({ name: 'Alice' })).toBe(true);
      expect(builder.wasCalledWith({ name: 'Bob' })).toBe(true);
      expect(builder.wasCalledWith({ name: 'Charlie' })).toBe(false);
    });

    it('should get last and first calls', async () => {
      const builder = new MockActionBuilder().mockSuccess({ ok: true });
      const mockAction = builder.build();

      await mockAction({ order: 1 });
      await mockAction({ order: 2 });
      await mockAction({ order: 3 });

      const firstCall = builder.getFirstCall();
      const lastCall = builder.getLastCall();

      expect(firstCall?.input).toEqual({ order: 1 });
      expect(lastCall?.input).toEqual({ order: 3 });
    });

    it('should clear history', async () => {
      const builder = new MockActionBuilder().mockSuccess({ ok: true });
      const mockAction = builder.build();

      await mockAction({ test: 'data' });
      expect(builder.getCallCount()).toBe(1);

      builder.clearHistory();
      expect(builder.getCallCount()).toBe(0);
      expect(builder.wasCalled()).toBe(false);
    });

    it('should trigger hooks', async () => {
      const beforeValidationSpy = createHookSpy();
      const afterValidationSpy = createHookSpy();
      const beforeExecutionSpy = createHookSpy();
      const afterExecutionSpy = createHookSpy();
      const successSpy = createHookSpy();
      const completeSpy = createHookSpy();

      const mockAction = createMockAction()
        .mockSuccess({ result: 'ok' })
        .withHooks({
          beforeValidation: [beforeValidationSpy.callback],
          afterValidation: [afterValidationSpy.callback],
          beforeExecution: [beforeExecutionSpy.callback],
          afterExecution: [afterExecutionSpy.callback],
          success: [successSpy.callback],
          complete: [completeSpy.callback],
        })
        .build();

      await mockAction({ test: 'data' });

      expect(beforeValidationSpy.wasCalled()).toBe(true);
      expect(afterValidationSpy.wasCalled()).toBe(true);
      expect(beforeExecutionSpy.wasCalled()).toBe(true);
      expect(afterExecutionSpy.wasCalled()).toBe(true);
      expect(successSpy.wasCalled()).toBe(true);
      expect(completeSpy.wasCalled()).toBe(true);
    });

    it('should trigger error hooks on auth error', async () => {
      const authErrorSpy = createHookSpy<AuthErrorContext>();
      const errorSpy = createHookSpy<ErrorContext>();

      const mockAction = createMockAction()
        .mockAuthError('Not authenticated')
        .withHooks({
          authError: [authErrorSpy.callback],
          error: [errorSpy.callback],
        })
        .build();

      await mockAction({ test: 'data' });

      expect(authErrorSpy.wasCalled()).toBe(true);
      expect(errorSpy.wasCalled()).toBe(true);

      const authErrorContext = authErrorSpy.getLastCall();
      expect(authErrorContext?.message).toBe('Not authenticated');
    });

    it('should trigger error hooks on input validation error', async () => {
      const inputValidationErrorSpy =
        createHookSpy<InputValidationErrorContext>();
      const errorSpy = createHookSpy<ErrorContext>();

      const errors = [createValidationError('email', 'invalid email')];

      const mockAction = createMockAction()
        .mockInputValidationError(errors)
        .withHooks({
          inputValidationError: [inputValidationErrorSpy.callback],
          error: [errorSpy.callback],
        })
        .build();

      await mockAction({ email: 'invalid' });

      expect(inputValidationErrorSpy.wasCalled()).toBe(true);
      expect(errorSpy.wasCalled()).toBe(true);

      const inputErrorContext = inputValidationErrorSpy.getLastCall();
      expect(inputErrorContext?.details).toEqual(errors);
    });

    it('should override previous mock settings', async () => {
      const builder = new MockActionBuilder()
        .mockSuccess({ result: 'success' })
        .mockAuthError('Not authenticated');

      const mockAction = builder.build();
      const result = await mockAction({ test: 'data' });

      // Auth error should override success
      expect(isAuthError(result)).toBe(true);
    });
  });

  describe('createTestContext', () => {
    it('should create a test context with input and user', () => {
      const input = { name: 'John', email: 'john@example.com' };
      const user = { id: '123', role: 'admin' };

      const context = createTestContext(input, user);

      expect(context.parsedInput).toEqual(input);
      expect(context.user).toEqual(user);
    });

    it('should create a test context without user', () => {
      const input = { name: 'John' };

      const context = createTestContext(input);

      expect(context.parsedInput).toEqual(input);
      expect(context.user).toBeUndefined();
    });
  });

  describe('createMockAuthHandler', () => {
    it('should return a user when authenticated', async () => {
      const user = { id: '123', role: 'admin' };
      const authHandler = createMockAuthHandler(user);

      const result = await authHandler();

      expect(result).toEqual(user);
    });

    it('should return null when not authenticated', async () => {
      const authHandler = createMockAuthHandler(null);

      const result = await authHandler();

      expect(result).toBeNull();
    });

    it('should return undefined when authentication is undefined', async () => {
      const authHandler = createMockAuthHandler(undefined);

      const result = await authHandler();

      expect(result).toBeUndefined();
    });
  });

  describe('result creators', () => {
    describe('createSuccessResult', () => {
      it('should create a success result', () => {
        const result = createSuccessResult({ id: '123', name: 'John' });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ id: '123', name: 'John' });
        }
      });
    });

    describe('createAuthErrorResult', () => {
      it('should create an auth error result with default message', () => {
        const result = createAuthErrorResult();

        expect(isAuthError(result)).toBe(true);
        if (isAuthError(result)) {
          expect(result.message).toBe('Authentication required');
        }
      });

      it('should create an auth error result with custom message', () => {
        const result = createAuthErrorResult('Invalid token');

        expect(isAuthError(result)).toBe(true);
        if (isAuthError(result)) {
          expect(result.message).toBe('Invalid token');
        }
      });
    });

    describe('createInputErrorResult', () => {
      it('should create an input error result with auto-generated message', () => {
        const errors = [
          createValidationError('email', 'must be a valid email'),
          createValidationError('name', 'should not be empty'),
        ];

        const result = createInputErrorResult(errors);

        expect(isInputError(result)).toBe(true);
        if (isInputError(result)) {
          expect(result.details).toEqual(errors);
          expect(result.message).toContain('email');
          expect(result.message).toContain('name');
        }
      });

      it('should create an input error result with custom message', () => {
        const errors = [createValidationError('email', 'invalid')];
        const result = createInputErrorResult(errors, 'Validation failed');

        expect(isInputError(result)).toBe(true);
        if (isInputError(result)) {
          expect(result.message).toBe('Validation failed');
        }
      });
    });

    describe('createOutputErrorResult', () => {
      it('should create an output error result', () => {
        const errors = [createValidationError('id', 'must be a string')];
        const result = createOutputErrorResult(errors);

        expect(isOutputError(result)).toBe(true);
        if (isOutputError(result)) {
          expect(result.details).toEqual(errors);
        }
      });
    });

    describe('createServerErrorResult', () => {
      it('should create a server error result', () => {
        const error = new Error('Database error');
        const result = createServerErrorResult('Internal server error', error);

        expect(isServerError(result)).toBe(true);
        if (isServerError(result)) {
          expect(result.message).toBe('Internal server error');
          expect(result.cause).toBe(error);
        }
      });

      it('should create a server error result without cause', () => {
        const result = createServerErrorResult('Something went wrong');

        expect(isServerError(result)).toBe(true);
        if (isServerError(result)) {
          expect(result.message).toBe('Something went wrong');
          expect(result.cause).toBeUndefined();
        }
      });
    });
  });

  describe('createValidationError', () => {
    it('should create a validation error with single constraint', () => {
      const error = createValidationError('email', 'must be a valid email');

      expect(error.field).toBe('email');
      expect(error.constraints).toEqual(['must be a valid email']);
    });

    it('should create a validation error with multiple constraints', () => {
      const error = createValidationError(
        'password',
        'too short',
        'missing special character'
      );

      expect(error.field).toBe('password');
      expect(error.constraints).toEqual([
        'too short',
        'missing special character',
      ]);
    });
  });

  describe('HookSpy', () => {
    it('should track hook calls', async () => {
      const spy = createHookSpy<{ value: number }>();

      await spy.callback({ value: 1 });
      await spy.callback({ value: 2 });

      expect(spy.getCallCount()).toBe(2);
      expect(spy.wasCalled()).toBe(true);

      const calls = spy.getCalls();
      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual({ value: 1 });
      expect(calls[1]).toEqual({ value: 2 });
    });

    it('should get first and last calls', async () => {
      const spy = createHookSpy<{ order: number }>();

      await spy.callback({ order: 1 });
      await spy.callback({ order: 2 });
      await spy.callback({ order: 3 });

      expect(spy.getFirstCall()).toEqual({ order: 1 });
      expect(spy.getLastCall()).toEqual({ order: 3 });
    });

    it('should check if called with predicate', async () => {
      const spy = createHookSpy<{ status: string }>();

      await spy.callback({ status: 'pending' });
      await spy.callback({ status: 'success' });

      expect(spy.wasCalledWith((ctx) => ctx.status === 'success')).toBe(true);
      expect(spy.wasCalledWith((ctx) => ctx.status === 'failed')).toBe(false);
    });

    it('should clear calls', async () => {
      const spy = createHookSpy();

      await spy.callback({ test: 'data' });
      expect(spy.getCallCount()).toBe(1);

      spy.clear();
      expect(spy.getCallCount()).toBe(0);
      expect(spy.wasCalled()).toBe(false);
    });

    it('should return undefined for first/last call when not called', () => {
      const spy = createHookSpy();

      expect(spy.getFirstCall()).toBeUndefined();
      expect(spy.getLastCall()).toBeUndefined();
    });
  });

  describe('waitFor', () => {
    it('should wait for condition to be true', async () => {
      let value = false;

      setTimeout(() => {
        value = true;
      }, 100);

      await waitFor(() => value, { timeout: 500, interval: 10 });

      expect(value).toBe(true);
    });

    it('should throw on timeout', async () => {
      await expect(
        waitFor(() => false, { timeout: 100, interval: 10 })
      ).rejects.toThrow('waitFor timeout exceeded');
    });

    it('should resolve immediately if condition is already true', async () => {
      const startTime = Date.now();
      await waitFor(() => true, { timeout: 1000, interval: 10 });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('wait', () => {
    it('should wait for specified duration', async () => {
      const startTime = Date.now();
      await wait(100);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(95);
      expect(duration).toBeLessThan(150);
    });
  });

  describe('createDeferred', () => {
    it('should create a deferred promise that can be resolved', async () => {
      const deferred = createDeferred<string>();

      setTimeout(() => {
        deferred.resolve('success');
      }, 50);

      const result = await deferred.promise;

      expect(result).toBe('success');
    });

    it('should create a deferred promise that can be rejected', async () => {
      const deferred = createDeferred<string>();

      setTimeout(() => {
        deferred.reject(new Error('failed'));
      }, 50);

      await expect(deferred.promise).rejects.toThrow('failed');
    });

    it('should allow multiple consumers of the same promise', async () => {
      const deferred = createDeferred<number>();

      const promise1 = deferred.promise;
      const promise2 = deferred.promise;

      deferred.resolve(42);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe(42);
      expect(result2).toBe(42);
    });
  });

  describe('Integration with real actions', () => {
    it('should be able to mock a real action', async () => {
      // Create a mock version for testing
      const builder = new MockActionBuilder<
        CreateUserInput,
        CreateUserOutput,
        unknown
      >().mockSuccess({
        id: 'mock-id',
        name: 'Mock User',
        email: 'mock@example.com',
      });
      const mockAction = builder.build();

      const result = await mockAction({
        name: 'Test',
        email: 'test@example.com',
      });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect((result.data as CreateUserOutput).id).toBe('mock-id');
        expect((result.data as CreateUserOutput).name).toBe('Mock User');
      }
    });

    it('should work with authenticated actions', async () => {
      const user = { id: '123', role: 'admin' };

      const mockAction = createMockAction()
        .mockUser(user)
        .mockSuccess({ result: 'ok' })
        .build();

      const result = await mockAction({ test: 'data' });

      expect(isSuccess(result)).toBe(true);
    });

    it('should simulate complex scenarios with custom implementation', async () => {
      let requestCount = 0;

      const builder = new MockActionBuilder<
        { action: string },
        { count: number },
        unknown
      >().mockImplementation(async (_input, _context) => {
        requestCount++;

        if (requestCount <= 2) {
          return createServerErrorResult('Temporary failure');
        }

        return createSuccessResult({ count: requestCount });
      });

      const mockAction = builder.build();

      // First two calls should fail
      const result1 = await mockAction({ action: 'test' });
      expect(isServerError(result1)).toBe(true);

      const result2 = await mockAction({ action: 'test' });
      expect(isServerError(result2)).toBe(true);

      // Third call should succeed
      const result3 = await mockAction({ action: 'test' });
      expect(isSuccess(result3)).toBe(true);
      if (isSuccess(result3)) {
        expect((result3.data as { count: number }).count).toBe(3);
      }
    });
  });
});
