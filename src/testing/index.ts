import 'reflect-metadata';
import type {
  ActionResult,
  ActionContext,
  AuthHandler,
  ValidationError,
  HookCallback,
  HookCallbacks,
} from '../types';

/**
 * Type for extracting input type from an action function
 */
type ExtractInput<T> = T extends (input?: infer I) => unknown ? I : never;

/**
 * Type for extracting output type from an action function
 */
type ExtractOutput<T> = T extends (
  input?: unknown
) => Promise<ActionResult<infer O>>
  ? O
  : never;

/**
 * Mock action configuration
 */
type MockActionConfig<TInput, TOutput, TUser> = {
  /**
   * Mock user to use in context
   */
  user?: TUser;
  /**
   * Mock successful result
   */
  success?: TOutput;
  /**
   * Mock authentication error
   */
  authError?: string;
  /**
   * Mock input validation errors
   */
  inputValidationError?: ValidationError[];
  /**
   * Mock output validation errors
   */
  outputValidationError?: ValidationError[];
  /**
   * Mock server error
   */
  serverError?: { message: string; cause?: unknown };
  /**
   * Custom implementation function
   */
  implementation?: (
    input: TInput,
    context: ActionContext<TInput, TUser>
  ) => Promise<ActionResult<TOutput>>;
  /**
   * Delay in milliseconds before resolving
   */
  delay?: number;
  /**
   * Hook callbacks for testing
   */
  hooks?: Partial<HookCallbacks<TInput, TOutput, TUser>>;
};

/**
 * Mock action builder for testing
 */
export class MockActionBuilder<
  TInput = unknown,
  TOutput = unknown,
  TUser = unknown,
> {
  private config: MockActionConfig<TInput, TOutput, TUser> = {};
  private callHistory: Array<{
    input: TInput;
    result: ActionResult<TOutput>;
    timestamp: Date;
  }> = [];

  /**
   * Set the mock user for authentication
   */
  mockUser(user: TUser): this {
    this.config.user = user;
    return this;
  }

  /**
   * Mock a successful result
   */
  mockSuccess(data: TOutput): this {
    this.config.success = data;
    this.config.authError = undefined;
    this.config.inputValidationError = undefined;
    this.config.outputValidationError = undefined;
    this.config.serverError = undefined;
    return this;
  }

  /**
   * Mock an authentication error
   */
  mockAuthError(message = 'Authentication required'): this {
    this.config.authError = message;
    this.config.success = undefined;
    this.config.inputValidationError = undefined;
    this.config.outputValidationError = undefined;
    this.config.serverError = undefined;
    return this;
  }

  /**
   * Mock input validation errors
   */
  mockInputValidationError(errors: ValidationError[]): this {
    this.config.inputValidationError = errors;
    this.config.success = undefined;
    this.config.authError = undefined;
    this.config.outputValidationError = undefined;
    this.config.serverError = undefined;
    return this;
  }

  /**
   * Mock output validation errors
   */
  mockOutputValidationError(errors: ValidationError[]): this {
    this.config.outputValidationError = errors;
    this.config.success = undefined;
    this.config.authError = undefined;
    this.config.inputValidationError = undefined;
    this.config.serverError = undefined;
    return this;
  }

  /**
   * Mock a server error
   */
  mockServerError(message: string, cause?: unknown): this {
    this.config.serverError = { message, cause };
    this.config.success = undefined;
    this.config.authError = undefined;
    this.config.inputValidationError = undefined;
    this.config.outputValidationError = undefined;
    return this;
  }

  /**
   * Set a custom implementation
   */
  mockImplementation(
    fn: (
      input: TInput,
      context: ActionContext<TInput, TUser>
    ) => Promise<ActionResult<TOutput>>
  ): this {
    this.config.implementation = fn;
    return this;
  }

  /**
   * Add a delay before the action resolves
   */
  withDelay(ms: number): this {
    this.config.delay = ms;
    return this;
  }

  /**
   * Set hook callbacks for testing
   */
  withHooks(hooks: Partial<HookCallbacks<TInput, TOutput, TUser>>): this {
    this.config.hooks = hooks;
    return this;
  }

  /**
   * Build the mock action function
   */
  build(): (input?: TInput) => Promise<ActionResult<TOutput>> {
    return async (input?: TInput): Promise<ActionResult<TOutput>> => {
      // Apply delay if configured
      if (this.config.delay) {
        await new Promise((resolve) => setTimeout(resolve, this.config.delay));
      }

      const context: ActionContext<TInput, TUser> = {
        parsedInput: input as TInput,
        user: this.config.user,
      };

      const timestamp = new Date();
      const actionId = Math.random().toString(36).substring(7);

      // Use custom implementation if provided
      if (this.config.implementation) {
        const result = await this.config.implementation(
          input as TInput,
          context
        );
        this.callHistory.push({
          input: input as TInput,
          result,
          timestamp,
        });
        return result;
      }

      // Trigger beforeValidation hook
      if (this.config.hooks?.beforeValidation) {
        for (const hook of this.config.hooks.beforeValidation) {
          await hook({
            actionId,
            timestamp,
            user: this.config.user,
            rawInput: input,
          });
        }
      }

      // Check for auth error
      if (this.config.authError !== undefined) {
        const result: ActionResult<TOutput> = {
          success: false,
          error: 'auth',
          message: this.config.authError,
        };

        // Trigger authError hook
        if (this.config.hooks?.authError) {
          for (const hook of this.config.hooks.authError) {
            await hook({
              actionId,
              timestamp,
              user: this.config.user,
              message: this.config.authError,
              error: new Error(this.config.authError),
            });
          }
        }

        // Trigger error hook
        if (this.config.hooks?.error) {
          for (const hook of this.config.hooks.error) {
            await hook({
              actionId,
              timestamp,
              user: this.config.user,
              errorType: 'auth',
              message: this.config.authError,
              error: new Error(this.config.authError),
            });
          }
        }

        this.callHistory.push({ input: input as TInput, result, timestamp });
        return result;
      }

      // Trigger afterValidation hook
      if (this.config.hooks?.afterValidation) {
        for (const hook of this.config.hooks.afterValidation) {
          await hook({
            actionId,
            timestamp,
            user: this.config.user,
            rawInput: input,
            validatedInput: input as TInput,
          });
        }
      }

      // Check for input validation error
      if (this.config.inputValidationError) {
        const message = this.config.inputValidationError
          .map((e) => `${e.field}: ${e.constraints.join(', ')}`)
          .join('; ');

        const result: ActionResult<TOutput> = {
          success: false,
          error: 'input',
          message,
          details: this.config.inputValidationError,
        };

        // Trigger inputValidationError hook
        if (this.config.hooks?.inputValidationError) {
          for (const hook of this.config.hooks.inputValidationError) {
            await hook({
              actionId,
              timestamp,
              user: this.config.user,
              rawInput: input,
              message,
              details: this.config.inputValidationError,
            });
          }
        }

        // Trigger error hook
        if (this.config.hooks?.error) {
          for (const hook of this.config.hooks.error) {
            await hook({
              actionId,
              timestamp,
              user: this.config.user,
              errorType: 'input',
              message,
              error: this.config.inputValidationError,
              parsedInput: input as TInput,
            });
          }
        }

        this.callHistory.push({ input: input as TInput, result, timestamp });
        return result;
      }

      // Trigger beforeExecution hook
      if (this.config.hooks?.beforeExecution) {
        for (const hook of this.config.hooks.beforeExecution) {
          await hook({
            actionId,
            timestamp,
            user: this.config.user,
            parsedInput: input as TInput,
          });
        }
      }

      // Check for server error
      if (this.config.serverError) {
        const result: ActionResult<TOutput> = {
          success: false,
          error: 'server',
          message: this.config.serverError.message,
          cause: this.config.serverError.cause,
        };

        // Trigger serverError hook
        if (this.config.hooks?.serverError) {
          for (const hook of this.config.hooks.serverError) {
            await hook({
              actionId,
              timestamp,
              user: this.config.user,
              parsedInput: input as TInput,
              message: this.config.serverError.message,
              cause: this.config.serverError.cause,
              error: new Error(this.config.serverError.message),
            });
          }
        }

        // Trigger error hook
        if (this.config.hooks?.error) {
          for (const hook of this.config.hooks.error) {
            await hook({
              actionId,
              timestamp,
              user: this.config.user,
              errorType: 'server',
              message: this.config.serverError.message,
              error: new Error(this.config.serverError.message),
              parsedInput: input as TInput,
            });
          }
        }

        this.callHistory.push({ input: input as TInput, result, timestamp });
        return result;
      }

      // Trigger afterExecution hook
      if (this.config.hooks?.afterExecution) {
        for (const hook of this.config.hooks.afterExecution) {
          await hook({
            actionId,
            timestamp,
            user: this.config.user,
            parsedInput: input as TInput,
            rawOutput: this.config.success as TOutput,
          });
        }
      }

      // Check for output validation error
      if (this.config.outputValidationError) {
        const message = this.config.outputValidationError
          .map((e) => `${e.field}: ${e.constraints.join(', ')}`)
          .join('; ');

        const result: ActionResult<TOutput> = {
          success: false,
          error: 'output',
          message,
          details: this.config.outputValidationError,
        };

        // Trigger outputValidationError hook
        if (this.config.hooks?.outputValidationError) {
          for (const hook of this.config.hooks.outputValidationError) {
            await hook({
              actionId,
              timestamp,
              user: this.config.user,
              parsedInput: input as TInput,
              rawOutput: this.config.success,
              message,
              details: this.config.outputValidationError,
            });
          }
        }

        // Trigger error hook
        if (this.config.hooks?.error) {
          for (const hook of this.config.hooks.error) {
            await hook({
              actionId,
              timestamp,
              user: this.config.user,
              errorType: 'output',
              message,
              error: this.config.outputValidationError,
              parsedInput: input as TInput,
            });
          }
        }

        this.callHistory.push({ input: input as TInput, result, timestamp });
        return result;
      }

      // Default success
      const result: ActionResult<TOutput> = {
        success: true,
        data: this.config.success as TOutput,
      };

      // Trigger success hook
      if (this.config.hooks?.success) {
        for (const hook of this.config.hooks.success) {
          await hook({
            actionId,
            timestamp,
            user: this.config.user,
            parsedInput: input as TInput,
            result,
            duration: this.config.delay || 0,
          });
        }
      }

      // Trigger complete hook
      if (this.config.hooks?.complete) {
        for (const hook of this.config.hooks.complete) {
          await hook({
            actionId,
            timestamp,
            user: this.config.user,
            parsedInput: input as TInput,
            result,
            duration: this.config.delay || 0,
          });
        }
      }

      this.callHistory.push({ input: input as TInput, result, timestamp });
      return result;
    };
  }

  /**
   * Get the call history
   */
  getCallHistory(): Array<{
    input: TInput;
    result: ActionResult<TOutput>;
    timestamp: Date;
  }> {
    return [...this.callHistory];
  }

  /**
   * Clear the call history
   */
  clearHistory(): void {
    this.callHistory = [];
  }

  /**
   * Get the number of times the mock action was called
   */
  getCallCount(): number {
    return this.callHistory.length;
  }

  /**
   * Check if the mock action was called
   */
  wasCalled(): boolean {
    return this.callHistory.length > 0;
  }

  /**
   * Check if the mock action was called with specific input
   */
  wasCalledWith(input: TInput): boolean {
    return this.callHistory.some(
      (call) => JSON.stringify(call.input) === JSON.stringify(input)
    );
  }

  /**
   * Get the last call
   */
  getLastCall():
    | { input: TInput; result: ActionResult<TOutput>; timestamp: Date }
    | undefined {
    return this.callHistory[this.callHistory.length - 1];
  }

  /**
   * Get the first call
   */
  getFirstCall():
    | { input: TInput; result: ActionResult<TOutput>; timestamp: Date }
    | undefined {
    return this.callHistory[0];
  }
}

/**
 * Create a mock action with type inference
 */
export function createMockAction<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TAction extends (input?: any) => Promise<ActionResult<any>>,
>(
  _action?: TAction
): MockActionBuilder<ExtractInput<TAction>, ExtractOutput<TAction>, unknown> {
  return new MockActionBuilder<
    ExtractInput<TAction>,
    ExtractOutput<TAction>,
    unknown
  >();
}

/**
 * Create a test context for action handlers
 */
export function createTestContext<TInput = unknown, TUser = unknown>(
  parsedInput: TInput,
  user?: TUser
): ActionContext<TInput, TUser> {
  return {
    parsedInput,
    user,
  };
}

/**
 * Create a mock authentication handler
 */
export function createMockAuthHandler<TUser>(
  user: TUser | null | undefined
): AuthHandler<TUser> {
  return async () => user;
}

/**
 * Create a successful action result
 */
export function createSuccessResult<T>(data: T): ActionResult<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Create an authentication error result
 */
export function createAuthErrorResult<T>(
  message = 'Authentication required'
): ActionResult<T> {
  return {
    success: false,
    error: 'auth',
    message,
  };
}

/**
 * Create an input validation error result
 */
export function createInputErrorResult<T>(
  errors: ValidationError[],
  message?: string
): ActionResult<T> {
  const errorMessage =
    message ||
    errors.map((e) => `${e.field}: ${e.constraints.join(', ')}`).join('; ');

  return {
    success: false,
    error: 'input',
    message: errorMessage,
    details: errors,
  };
}

/**
 * Create an output validation error result
 */
export function createOutputErrorResult<T>(
  errors: ValidationError[],
  message?: string
): ActionResult<T> {
  const errorMessage =
    message ||
    errors.map((e) => `${e.field}: ${e.constraints.join(', ')}`).join('; ');

  return {
    success: false,
    error: 'output',
    message: errorMessage,
    details: errors,
  };
}

/**
 * Create a server error result
 */
export function createServerErrorResult<T>(
  message: string,
  cause?: unknown
): ActionResult<T> {
  return {
    success: false,
    error: 'server',
    message,
    cause,
  };
}

/**
 * Create a validation error object
 */
export function createValidationError(
  field: string,
  ...constraints: string[]
): ValidationError {
  return {
    field,
    constraints,
  };
}

/**
 * Hook spy for testing hook callbacks
 */
export class HookSpy<TContext = unknown> {
  private calls: TContext[] = [];

  /**
   * The hook callback function
   */
  readonly callback: HookCallback<TContext> = async (context: TContext) => {
    this.calls.push(context);
  };

  /**
   * Get all hook calls
   */
  getCalls(): TContext[] {
    return [...this.calls];
  }

  /**
   * Get the number of times the hook was called
   */
  getCallCount(): number {
    return this.calls.length;
  }

  /**
   * Check if the hook was called
   */
  wasCalled(): boolean {
    return this.calls.length > 0;
  }

  /**
   * Get the last call context
   */
  getLastCall(): TContext | undefined {
    return this.calls[this.calls.length - 1];
  }

  /**
   * Get the first call context
   */
  getFirstCall(): TContext | undefined {
    return this.calls[0];
  }

  /**
   * Clear all calls
   */
  clear(): void {
    this.calls = [];
  }

  /**
   * Check if the hook was called with a specific condition
   */
  wasCalledWith(predicate: (context: TContext) => boolean): boolean {
    return this.calls.some(predicate);
  }
}

/**
 * Create a hook spy
 */
export function createHookSpy<TContext = unknown>(): HookSpy<TContext> {
  return new HookSpy<TContext>();
}

/**
 * Wait for a condition to be true (useful for async testing)
 */
export async function waitFor(
  condition: () => boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('waitFor timeout exceeded');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Wait for a specific duration
 */
export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a deferred promise for testing async scenarios
 */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
