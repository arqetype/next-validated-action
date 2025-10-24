import 'reflect-metadata';
import type { ClassConstructor } from 'class-transformer';
import type { ValidatorOptions } from 'class-validator';
import type {
  ActionResult,
  ActionContext,
  AuthHandler,
  Middleware,
  Logger,
  RetryConfig,
  RateLimitConfig,
  ThrottleConfig,
  DebounceConfig,
  CacheConfig,
  HookEvent,
  HookCallback,
  BeforeValidationContext,
  AfterValidationContext,
  BeforeExecutionContext,
  AfterExecutionContext,
  SuccessContext,
  ErrorContext,
  AuthErrorContext,
  InputValidationErrorContext,
  OutputValidationErrorContext,
  ServerErrorContext,
  RetryContext,
  CompleteContext,
} from '../types';
import { formatError, withRetry } from '../utils';
import { getOrCreateDebouncedAction } from '../debounce';
import { getGlobalMemoryCache, generateDefaultCacheKey } from '../cache';
import type { BuilderState } from './types';
import { HookManager } from './hooks';
import { MiddlewareExecutor } from './middleware';
import { ActionExecutor } from './execution';

/**
 * Builder class for creating type-safe server actions with validation
 * @template TInput - The input type
 * @template TOutput - The output type
 * @template TUser - The user type (if authenticated)
 */
export class ActionClientBuilder<
  TInput = unknown,
  TOutput = unknown,
  TUser = unknown,
> {
  private state: BuilderState<TInput, TOutput, TUser>;

  constructor(state?: BuilderState<TInput, TOutput, TUser>) {
    this.state = state || {
      middlewares: [],
      hooks: {},
    };
  }

  /**
   * Specify the input DTO class for validation
   * @param dto - The DTO class to validate input against
   * @returns A new builder with the specified input DTO
   * @example
   * ```ts
   * class MyInput {
   *   @IsString()
   *   name: string;
   * }
   *
   * action.inputDto(MyInput)
   * ```
   */
  inputDto<TNewInput extends object>(
    dto: ClassConstructor<TNewInput>
  ): ActionClientBuilder<TNewInput, TOutput, TUser> {
    return new ActionClientBuilder<TNewInput, TOutput, TUser>({
      ...this.state,
      inputDto: dto,
      middlewares: [] as Middleware<
        ActionContext<TNewInput, TUser>,
        ActionResult<TOutput>
      >[],
      throttleConfig: this.state.throttleConfig as
        | ThrottleConfig<TNewInput, TUser>
        | undefined,
      cacheConfig: undefined as CacheConfig<TNewInput> | undefined,
      hooks: {} as BuilderState<TNewInput, TOutput, TUser>['hooks'],
    });
  }

  /**
   * Specify the output DTO class for validation
   * @param dto - The DTO class to validate output against
   * @returns A new builder with the specified output DTO
   * @example
   * ```ts
   * class MyOutput {
   *   @IsString()
   *   message: string;
   * }
   *
   * action.outputDto(MyOutput)
   * ```
   */
  outputDto<TNewOutput extends object>(
    dto: ClassConstructor<TNewOutput>
  ): ActionClientBuilder<TInput, TNewOutput, TUser> {
    return new ActionClientBuilder<TInput, TNewOutput, TUser>({
      ...this.state,
      outputDto: dto,
      middlewares: [] as Middleware<
        ActionContext<TInput, TUser>,
        ActionResult<TNewOutput>
      >[],
      hooks: {} as BuilderState<TInput, TNewOutput, TUser>['hooks'],
    });
  }

  /**
   * Require authentication for this action
   * @param authHandler - Function that returns the authenticated user or null
   * @returns A new builder with authentication required
   * @example
   * ```ts
   * action.needsAuth(async () => {
   *   return await getCurrentUser();
   * })
   * ```
   */
  needsAuth<TNewUser = unknown>(
    authHandler: AuthHandler<TNewUser>
  ): ActionClientBuilder<TInput, TOutput, TNewUser> {
    return new ActionClientBuilder<TInput, TOutput, TNewUser>({
      ...this.state,
      authHandler,
      middlewares: [] as Middleware<
        ActionContext<TInput, TNewUser>,
        ActionResult<TOutput>
      >[],
      throttleConfig: this.state.throttleConfig as
        | ThrottleConfig<TInput, TNewUser>
        | undefined,
      hooks: {} as BuilderState<TInput, TOutput, TNewUser>['hooks'],
    });
  }

  /**
   * Add a middleware to the action pipeline
   * @param middleware - Middleware function to execute
   * @returns A new builder with the middleware added
   * @example
   * ```ts
   * action.use(async (ctx, next) => {
   *   console.log('Before action');
   *   const result = await next();
   *   console.log('After action');
   *   return result;
   * })
   * ```
   */
  use(
    middleware: Middleware<ActionContext<TInput, TUser>, ActionResult<TOutput>>
  ): ActionClientBuilder<TInput, TOutput, TUser> {
    return new ActionClientBuilder<TInput, TOutput, TUser>({
      ...this.state,
      middlewares: [...this.state.middlewares, middleware],
    });
  }

  /**
   * Add a logger for observability
   * @param logger - Logger function
   * @returns A new builder with the logger configured
   * @example
   * ```ts
   * action.logger((level, message, meta) => {
   *   console.log(`[${level}] ${message}`, meta);
   * })
   * ```
   */
  logger(logger: Logger): ActionClientBuilder<TInput, TOutput, TUser> {
    return new ActionClientBuilder<TInput, TOutput, TUser>({
      ...this.state,
      logger,
    });
  }

  /**
   * Configure retry logic for the action
   * @param config - Retry configuration
   * @returns A new builder with retry configured
   * @example
   * ```ts
   * action.retry({ attempts: 3, delay: 1000, backoff: 'exponential' })
   * ```
   */
  retry(config: RetryConfig): ActionClientBuilder<TInput, TOutput, TUser> {
    return new ActionClientBuilder<TInput, TOutput, TUser>({
      ...this.state,
      retryConfig: config,
    });
  }

  /**
   * Configure rate limiting metadata (for informational purposes)
   * Note: Actual rate limiting enforcement must be implemented separately
   * @param config - Rate limit configuration
   * @returns A new builder with rate limit metadata
   * @example
   * ```ts
   * action.rateLimit({ maxCalls: 10, windowMs: 60000 })
   * ```
   */
  rateLimit(
    config: RateLimitConfig
  ): ActionClientBuilder<TInput, TOutput, TUser> {
    return new ActionClientBuilder<TInput, TOutput, TUser>({
      ...this.state,
      rateLimitConfig: config,
    });
  }

  /**
   * Configure throttling to limit execution frequency
   * @param config - Throttle configuration
   * @example
   * ```ts
   * action.throttle({
   *   maxCalls: 10,
   *   windowMs: 60000, // 10 calls per minute
   *   strategy: 'sliding',
   *   identifier: (ctx) => ctx.user?.id || ctx.ip
   * })
   * ```
   */
  throttle(
    config: ThrottleConfig<TInput, TUser>
  ): ActionClientBuilder<TInput, TOutput, TUser> {
    return new ActionClientBuilder<TInput, TOutput, TUser>({
      ...this.state,
      throttleConfig: config,
    });
  }

  /**
   * Configure debouncing for the action
   * @param delay - Delay in milliseconds before executing the action
   * @returns A new builder with debouncing configured
   * @example
   * ```ts
   * action.debounce(300)
   * ```
   */
  debounce(delay: number): ActionClientBuilder<TInput, TOutput, TUser> {
    return new ActionClientBuilder<TInput, TOutput, TUser>({
      ...this.state,
      debounceConfig: { delay, trailing: true },
    });
  }

  /**
   * Configure debouncing with advanced options for the action
   * @param config - Debounce configuration
   * @returns A new builder with debouncing configured
   * @example
   * ```ts
   * action.debounceOptions({
   *   delay: 300,
   *   leading: false,
   *   trailing: true,
   *   maxWait: 1000
   * })
   * ```
   */
  debounceOptions(
    config: DebounceConfig
  ): ActionClientBuilder<TInput, TOutput, TUser> {
    return new ActionClientBuilder<TInput, TOutput, TUser>({
      ...this.state,
      debounceConfig: config,
    });
  }

  /**
   * Configure caching for the action
   * @param config - Cache configuration
   * @returns A new builder with caching configured
   * @example
   * ```ts
   * action.cache({
   *   ttl: 60000, // 1 minute
   *   key: (input) => `user-${input.id}`,
   *   cacheErrors: false
   * })
   * ```
   */
  cache(
    config: CacheConfig<TInput>
  ): ActionClientBuilder<TInput, TOutput, TUser> {
    return new ActionClientBuilder<TInput, TOutput, TUser>({
      ...this.state,
      cacheConfig: config,
    });
  }

  /**
   * Configure validation options for class-validator
   * @param options - Validation options
   * @returns A new builder with validation options configured
   * @example
   * ```ts
   * action.validationOptions({
   *   whitelist: true,
   *   forbidNonWhitelisted: true,
   *   stopAtFirstError: false
   * })
   * ```
   */
  validationOptions(
    options: ValidatorOptions
  ): ActionClientBuilder<TInput, TOutput, TUser> {
    return new ActionClientBuilder<TInput, TOutput, TUser>({
      ...this.state,
      validationOptions: options,
    });
  }

  /**
   * Register a hook callback for a specific event
   * @param event - The event name to listen for
   * @param callback - The callback function to execute
   * @returns A new builder with the hook registered
   * @example
   * ```ts
   * action
   *   .on('success', async (ctx) => {
   *     console.log('Action succeeded!', ctx.result);
   *   })
   *   .on('error', async (ctx) => {
   *     console.error('Action failed!', ctx.error);
   *   })
   * ```
   */
  on<E extends HookEvent>(
    event: E,
    callback: E extends 'beforeValidation'
      ? HookCallback<BeforeValidationContext<TUser>>
      : E extends 'afterValidation'
        ? HookCallback<AfterValidationContext<TInput, TUser>>
        : E extends 'beforeExecution'
          ? HookCallback<BeforeExecutionContext<TInput, TUser>>
          : E extends 'afterExecution'
            ? HookCallback<AfterExecutionContext<TInput, TOutput, TUser>>
            : E extends 'success'
              ? HookCallback<SuccessContext<TInput, TOutput, TUser>>
              : E extends 'error'
                ? HookCallback<ErrorContext<TInput, TUser>>
                : E extends 'authError'
                  ? HookCallback<AuthErrorContext<TUser>>
                  : E extends 'inputValidationError'
                    ? HookCallback<InputValidationErrorContext<TUser>>
                    : E extends 'outputValidationError'
                      ? HookCallback<
                          OutputValidationErrorContext<TInput, TUser>
                        >
                      : E extends 'serverError'
                        ? HookCallback<ServerErrorContext<TInput, TUser>>
                        : E extends 'retry'
                          ? HookCallback<RetryContext<TUser>>
                          : E extends 'complete'
                            ? HookCallback<
                                CompleteContext<TInput, TOutput, TUser>
                              >
                            : never
  ): ActionClientBuilder<TInput, TOutput, TUser> {
    const hookManager = new HookManager<TInput, TOutput, TUser>(
      this.state.hooks,
      this.state.logger
    );
    const newHooks = hookManager.registerHook(event, callback);

    return new ActionClientBuilder<TInput, TOutput, TUser>({
      ...this.state,
      hooks: newHooks,
    });
  }

  /**
   * Define the action handler
   * @param handler - The action handler function
   * @returns A function that executes the action with all configured features
   * @example
   * ```ts
   * const myAction = action
   *   .inputDto(MyInput)
   *   .outputDto(MyOutput)
   *   .action(async ({ parsedInput, user }) => {
   *     // Your action logic here
   *     return { success: true };
   *   });
   * ```
   */
  action(
    handler: (context: ActionContext<TInput, TUser>) => Promise<TOutput>
  ): (input?: unknown) => Promise<ActionResult<TOutput>> {
    // Generate a unique ID for this action definition (not per call)
    const actionDefinitionId = Math.random().toString(36).substring(7);

    // Create hook manager
    const hookManager = new HookManager<TInput, TOutput, TUser>(
      this.state.hooks,
      this.state.logger
    );

    // Create middleware executor
    const middlewareExecutor = new MiddlewareExecutor<TInput, TOutput, TUser>(
      this.state.middlewares
    );

    // Create action executor
    const executor = new ActionExecutor<TInput, TOutput, TUser>({
      inputDto: this.state.inputDto,
      outputDto: this.state.outputDto,
      authHandler: this.state.authHandler,
      middlewareExecutor,
      hookManager,
      validationOptions: this.state.validationOptions,
      throttleConfig: this.state.throttleConfig,
      actionDefinitionId,
      logger: this.state.logger,
    });

    const coreActionFn = async (
      input: unknown
    ): Promise<ActionResult<TOutput>> => {
      const actionId = Math.random().toString(36).substring(7);
      const startTime = Date.now();

      this.log('info', 'Action started', { actionId, hasInput: !!input });

      // Check cache if configured
      const cacheStorage = this.getCacheStorage();
      const cacheKey = this.getCacheKey(input);

      if (cacheStorage && cacheKey) {
        const cached = await cacheStorage.get<ActionResult<TOutput>>(cacheKey);
        if (cached) {
          this.log('debug', 'Cache hit', { actionId, cacheKey });
          return cached;
        }
        this.log('debug', 'Cache miss', { actionId, cacheKey });
      }

      // Execute the core action logic
      const executeAction = async (
        isRetry = false
      ): Promise<ActionResult<TOutput>> => {
        // Execute the action (throttle check happens inside executor after validation)
        return await executor.execute(
          actionId,
          input,
          handler,
          isRetry,
          startTime
        );
      };

      // Apply retry logic if configured
      let result: ActionResult<TOutput>;
      if (this.state.retryConfig) {
        result = await this.executeWithRetry(
          executeAction,
          actionId,
          hookManager,
          startTime
        );
      } else {
        result = await executeAction();
      }

      // Cache the result if configured
      await this.cacheResult(actionId, cacheStorage, cacheKey, result);

      // Trigger complete hook for non-retry case
      if (!this.state.retryConfig) {
        const duration = Date.now() - startTime;
        await hookManager.triggerHook('complete', {
          actionId,
          timestamp: new Date(),
          user: undefined,
          parsedInput: undefined,
          result,
          duration,
        });
      }

      return result;
    };

    // If debouncing is configured, wrap the action function
    if (this.state.debounceConfig) {
      const debouncedFn = getOrCreateDebouncedAction(
        actionDefinitionId,
        coreActionFn,
        this.state.debounceConfig
      );
      return debouncedFn as (input?: unknown) => Promise<ActionResult<TOutput>>;
    }

    return coreActionFn;
  }

  /**
   * Get the rate limit configuration (if set)
   * Useful for accessing metadata in middleware or external rate limiters
   */
  getRateLimitConfig(): RateLimitConfig | undefined {
    return this.state.rateLimitConfig;
  }

  /**
   * Get cache storage instance
   */
  private getCacheStorage() {
    if (!this.state.cacheConfig) {
      return undefined;
    }

    return this.state.cacheConfig.storage === 'memory' ||
      !this.state.cacheConfig.storage
      ? getGlobalMemoryCache()
      : this.state.cacheConfig.storage;
  }

  /**
   * Get cache key for input
   */
  private getCacheKey(input: unknown): string | undefined {
    if (!this.state.cacheConfig) {
      return undefined;
    }

    return this.state.cacheConfig.key
      ? this.state.cacheConfig.key(input as TInput)
      : generateDefaultCacheKey(input);
  }

  /**
   * Execute action with retry logic
   */
  private async executeWithRetry(
    executeAction: (isRetry?: boolean) => Promise<ActionResult<TOutput>>,
    actionId: string,
    hookManager: HookManager<TInput, TOutput, TUser>,
    startTime: number
  ): Promise<ActionResult<TOutput>> {
    if (!this.state.retryConfig) {
      return await executeAction();
    }

    this.log('debug', 'Executing with retry logic', {
      actionId,
      attempts: this.state.retryConfig.attempts,
    });

    let lastResult: ActionResult<TOutput> | undefined;
    let currentAttempt = 0;

    try {
      const executeWithRetryHook = async (): Promise<ActionResult<TOutput>> => {
        try {
          currentAttempt++;

          if (currentAttempt > 1 && this.state.retryConfig) {
            // Calculate delay for retry hook
            const delay =
              this.state.retryConfig.backoff === 'exponential'
                ? this.state.retryConfig.delay * Math.pow(2, currentAttempt - 2)
                : this.state.retryConfig.delay * (currentAttempt - 1);

            // Trigger retry hook
            await hookManager.triggerHook('retry', {
              actionId,
              timestamp: new Date(),
              user: undefined,
              attempt: currentAttempt,
              maxAttempts: this.state.retryConfig.attempts,
              delay,
              error: lastResult,
            });
          }

          const result = await executeAction(currentAttempt > 1);

          // If the action succeeded, return the result
          if (result.success) {
            return result;
          }

          // Store the last error result
          lastResult = result;

          // For server errors, throw to trigger retry
          // BUT don't retry throttle errors
          if (
            result.error === 'server' &&
            !result.message.includes('Too many requests')
          ) {
            throw new Error(result.message);
          }

          // For validation, auth, or throttle errors, don't retry
          return result;
        } catch (error) {
          lastResult = {
            success: false,
            error: 'server',
            message: formatError(error),
            cause: error,
          } as ActionResult<TOutput>;
          throw error;
        }
      };

      const retryResult = await withRetry(
        executeWithRetryHook,
        this.state.retryConfig
      );

      return retryResult;
    } catch (error) {
      this.log('error', 'All retry attempts failed', {
        actionId,
        error: formatError(error),
      });

      // Return the last result if we have one
      return (
        lastResult ||
        ({
          success: false,
          error: 'server',
          message: formatError(error),
          cause: error,
        } as ActionResult<TOutput>)
      );
    } finally {
      // Trigger complete hook
      const duration = Date.now() - startTime;
      const finalResult =
        lastResult ||
        ({
          success: false,
          error: 'server',
          message: 'Unknown error',
        } as ActionResult<TOutput>);

      await hookManager.triggerHook('complete', {
        actionId,
        timestamp: new Date(),
        user: undefined,
        parsedInput: undefined,
        result: finalResult,
        duration,
      });
    }
  }

  /**
   * Cache the result if configured
   */
  private async cacheResult(
    actionId: string,
    cacheStorage: ReturnType<typeof this.getCacheStorage>,
    cacheKey: string | undefined,
    result: ActionResult<TOutput>
  ): Promise<void> {
    if (!cacheStorage || !cacheKey) {
      return;
    }

    const shouldCache =
      result.success || (this.state.cacheConfig?.cacheErrors ?? false);

    if (shouldCache) {
      await cacheStorage.set(cacheKey, result, this.state.cacheConfig?.ttl);
      this.log('debug', 'Result cached', { actionId, cacheKey });
    }
  }

  /**
   * Internal logging helper
   */
  private log(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    meta?: Record<string, unknown>
  ): void {
    if (this.state.logger) {
      this.state.logger(level, message, meta);
    }
  }
}

/**
 * Default action builder instance
 * Start building your action from here
 * @example
 * ```ts
 * export const myAction = action
 *   .inputDto(MyInput)
 *   .outputDto(MyOutput)
 *   .action(async ({ parsedInput }) => {
 *     return { success: true };
 *   });
 * ```
 */
export const action = new ActionClientBuilder();
