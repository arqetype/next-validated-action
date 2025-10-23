import 'reflect-metadata';
import { instanceToPlain, type ClassConstructor } from 'class-transformer';
import { ValidatorOptions } from 'class-validator';
import type {
  ActionResult,
  ActionContext,
  AuthHandler,
  Middleware,
  Logger,
  RetryConfig,
  RateLimitConfig,
  DebounceConfig,
  CacheConfig,
  CacheStorage,
  HookEvent,
  HookCallback,
  HookCallbacks,
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
} from './types';
import { validateData, formatValidationErrors } from './validation';
import { withRetry, formatError } from './utils';
import { getOrCreateDebouncedAction } from './debounce';
import { getGlobalMemoryCache, generateDefaultCacheKey } from './cache';

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
  private _inputDto?: ClassConstructor<TInput>;
  private _outputDto?: ClassConstructor<TOutput>;
  private _authHandler?: AuthHandler<TUser>;
  private _middlewares: Middleware<
    ActionContext<TInput, TUser>,
    ActionResult<TOutput>
  >[] = [];
  private _logger?: Logger;
  private _retryConfig?: RetryConfig;
  private _rateLimitConfig?: RateLimitConfig;
  private _debounceConfig?: DebounceConfig;
  private _cacheConfig?: CacheConfig<TInput>;
  private _validationOptions?: ValidatorOptions;
  private _hooks: Partial<HookCallbacks<TInput, TOutput, TUser>> = {};

  constructor(
    inputDto?: ClassConstructor<TInput>,
    outputDto?: ClassConstructor<TOutput>,
    authHandler?: AuthHandler<TUser>,
    middlewares: Middleware<
      ActionContext<TInput, TUser>,
      ActionResult<TOutput>
    >[] = [],
    logger?: Logger,
    retryConfig?: RetryConfig,
    rateLimitConfig?: RateLimitConfig,
    debounceConfig?: DebounceConfig,
    cacheConfig?: CacheConfig<TInput>,
    validationOptions?: ValidatorOptions,
    hooks: Partial<HookCallbacks<TInput, TOutput, TUser>> = {}
  ) {
    this._inputDto = inputDto;
    this._outputDto = outputDto;
    this._authHandler = authHandler;
    this._middlewares = middlewares;
    this._logger = logger;
    this._retryConfig = retryConfig;
    this._rateLimitConfig = rateLimitConfig;
    this._debounceConfig = debounceConfig;
    this._cacheConfig = cacheConfig;
    this._validationOptions = validationOptions;
    this._hooks = hooks;
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
    return new ActionClientBuilder<TNewInput, TOutput, TUser>(
      dto,
      this._outputDto as ClassConstructor<TOutput>,
      this._authHandler,
      [] as Middleware<
        ActionContext<TNewInput, TUser>,
        ActionResult<TOutput>
      >[],
      this._logger,
      this._retryConfig,
      this._rateLimitConfig,
      this._debounceConfig,
      undefined as CacheConfig<TNewInput> | undefined,
      this._validationOptions,
      this._hooks as Partial<HookCallbacks<TNewInput, TOutput, TUser>>
    );
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
    return new ActionClientBuilder<TInput, TNewOutput, TUser>(
      this._inputDto as ClassConstructor<TInput>,
      dto,
      this._authHandler,
      [] as Middleware<
        ActionContext<TInput, TUser>,
        ActionResult<TNewOutput>
      >[],
      this._logger,
      this._retryConfig,
      this._rateLimitConfig,
      this._debounceConfig,
      this._cacheConfig as CacheConfig<TInput>,
      this._validationOptions,
      this._hooks as Partial<HookCallbacks<TInput, TNewOutput, TUser>>
    );
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
    return new ActionClientBuilder<TInput, TOutput, TNewUser>(
      this._inputDto as ClassConstructor<TInput>,
      this._outputDto as ClassConstructor<TOutput>,
      authHandler,
      [] as Middleware<
        ActionContext<TInput, TNewUser>,
        ActionResult<TOutput>
      >[],
      this._logger,
      this._retryConfig,
      this._rateLimitConfig,
      this._debounceConfig,
      this._cacheConfig as CacheConfig<TInput>,
      this._validationOptions,
      {} as Partial<HookCallbacks<TInput, TOutput, TNewUser>>
    );
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
    return new ActionClientBuilder<TInput, TOutput, TUser>(
      this._inputDto as ClassConstructor<TInput>,
      this._outputDto as ClassConstructor<TOutput>,
      this._authHandler,
      [...this._middlewares, middleware],
      this._logger,
      this._retryConfig,
      this._rateLimitConfig,
      this._debounceConfig,
      this._cacheConfig,
      this._validationOptions,
      this._hooks
    );
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
    return new ActionClientBuilder<TInput, TOutput, TUser>(
      this._inputDto as ClassConstructor<TInput>,
      this._outputDto as ClassConstructor<TOutput>,
      this._authHandler,
      this._middlewares,
      logger,
      this._retryConfig,
      this._rateLimitConfig,
      this._debounceConfig,
      this._cacheConfig,
      this._validationOptions,
      this._hooks
    );
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
    return new ActionClientBuilder<TInput, TOutput, TUser>(
      this._inputDto as ClassConstructor<TInput>,
      this._outputDto as ClassConstructor<TOutput>,
      this._authHandler,
      this._middlewares,
      this._logger,
      config,
      this._rateLimitConfig,
      this._debounceConfig,
      this._cacheConfig,
      this._validationOptions,
      this._hooks
    );
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
    return new ActionClientBuilder<TInput, TOutput, TUser>(
      this._inputDto as ClassConstructor<TInput>,
      this._outputDto as ClassConstructor<TOutput>,
      this._authHandler,
      this._middlewares,
      this._logger,
      this._retryConfig,
      config,
      this._debounceConfig,
      this._cacheConfig,
      this._validationOptions,
      this._hooks
    );
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
    return new ActionClientBuilder<TInput, TOutput, TUser>(
      this._inputDto as ClassConstructor<TInput>,
      this._outputDto as ClassConstructor<TOutput>,
      this._authHandler,
      this._middlewares,
      this._logger,
      this._retryConfig,
      this._rateLimitConfig,
      { delay, trailing: true },
      this._cacheConfig,
      this._validationOptions,
      this._hooks
    );
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
    return new ActionClientBuilder<TInput, TOutput, TUser>(
      this._inputDto as ClassConstructor<TInput>,
      this._outputDto as ClassConstructor<TOutput>,
      this._authHandler,
      this._middlewares,
      this._logger,
      this._retryConfig,
      this._rateLimitConfig,
      config,
      this._cacheConfig,
      this._validationOptions,
      this._hooks
    );
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
    return new ActionClientBuilder<TInput, TOutput, TUser>(
      this._inputDto as ClassConstructor<TInput>,
      this._outputDto as ClassConstructor<TOutput>,
      this._authHandler,
      this._middlewares,
      this._logger,
      this._retryConfig,
      this._rateLimitConfig,
      this._debounceConfig,
      config,
      this._validationOptions,
      this._hooks
    );
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
    return new ActionClientBuilder<TInput, TOutput, TUser>(
      this._inputDto as ClassConstructor<TInput>,
      this._outputDto as ClassConstructor<TOutput>,
      this._authHandler,
      this._middlewares,
      this._logger,
      this._retryConfig,
      this._rateLimitConfig,
      this._debounceConfig,
      this._cacheConfig,
      options,
      this._hooks
    );
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
    const newHooks = { ...this._hooks };
    const existingCallbacks = (newHooks[event] ||
      []) as HookCallback<unknown>[];
    (newHooks[event] as HookCallback<unknown>[]) = [
      ...existingCallbacks,
      callback as HookCallback<unknown>,
    ];

    return new ActionClientBuilder<TInput, TOutput, TUser>(
      this._inputDto as ClassConstructor<TInput>,
      this._outputDto as ClassConstructor<TOutput>,
      this._authHandler,
      this._middlewares,
      this._logger,
      this._retryConfig,
      this._rateLimitConfig,
      this._debounceConfig,
      this._cacheConfig,
      this._validationOptions,
      newHooks
    );
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

    const coreActionFn = async (
      input: unknown
    ): Promise<ActionResult<TOutput>> => {
      const actionId = Math.random().toString(36).substring(7);
      const startTime = Date.now();

      this._log('info', 'Action started', { actionId, hasInput: !!input });

      // Check cache if configured
      let cacheStorage: CacheStorage | undefined;
      let cacheKey: string | undefined;

      if (this._cacheConfig) {
        cacheStorage =
          this._cacheConfig.storage === 'memory' || !this._cacheConfig.storage
            ? getGlobalMemoryCache()
            : this._cacheConfig.storage;

        cacheKey = this._cacheConfig.key
          ? this._cacheConfig.key(input as TInput)
          : generateDefaultCacheKey(input);

        // Try to get from cache
        const cached = await cacheStorage.get<ActionResult<TOutput>>(cacheKey);
        if (cached) {
          this._log('debug', 'Cache hit', { actionId, cacheKey });
          return cached;
        }

        this._log('debug', 'Cache miss', { actionId, cacheKey });
      }

      // Execute the core action logic
      const executeAction = async (): Promise<ActionResult<TOutput>> => {
        // 1. Authentication
        let user: TUser | undefined;

        if (this._authHandler) {
          this._log('debug', 'Checking authentication', { actionId });

          try {
            const currentUser = await this._authHandler();

            if (!currentUser) {
              this._log('warn', 'Authentication failed - no user', {
                actionId,
              });

              const authErrorResult = {
                success: false,
                error: 'auth',
                message: 'Authentication required',
              } as const;

              // Trigger authError hook
              await this._triggerHook('authError', {
                actionId,
                timestamp: new Date(),
                user,
                message: authErrorResult.message,
                error: new Error('Authentication required'),
              });

              // Trigger generic error hook
              await this._triggerHook('error', {
                actionId,
                timestamp: new Date(),
                user,
                errorType: 'auth',
                message: authErrorResult.message,
                error: new Error('Authentication required'),
              });

              return authErrorResult;
            }

            user = currentUser;
            this._log('debug', 'Authentication successful', { actionId });
          } catch (error) {
            this._log('error', 'Authentication error', {
              actionId,
              error: formatError(error),
            });

            const authErrorResult = {
              success: false,
              error: 'auth',
              message: 'Authentication failed',
            } as const;

            // Trigger authError hook
            await this._triggerHook('authError', {
              actionId,
              timestamp: new Date(),
              user,
              message: authErrorResult.message,
              error,
            });

            // Trigger generic error hook
            await this._triggerHook('error', {
              actionId,
              timestamp: new Date(),
              user,
              errorType: 'auth',
              message: authErrorResult.message,
              error,
            });

            return authErrorResult;
          }
        }

        // 2. Input validation
        let parsedInput: TInput = input as TInput;

        if (this._inputDto) {
          this._log('debug', 'Validating input', { actionId });

          // Trigger beforeValidation hook
          await this._triggerHook('beforeValidation', {
            actionId,
            timestamp: new Date(),
            user,
            rawInput: input,
          });

          const validationResult = await validateData(
            this._inputDto as ClassConstructor<object>,
            input,
            'Invalid input',
            this._validationOptions
          );

          if (!validationResult.valid) {
            this._log('warn', 'Input validation failed', {
              actionId,
              errors: validationResult.errors,
              details: validationResult.details,
            });

            const inputErrorResult = {
              success: false,
              error: 'input',
              message: formatValidationErrors(validationResult.details),
              details: validationResult.details,
            } as const;

            // Trigger inputValidationError hook
            await this._triggerHook('inputValidationError', {
              actionId,
              timestamp: new Date(),
              user,
              rawInput: input,
              message: inputErrorResult.message,
              details: validationResult.details,
            });

            // Trigger generic error hook
            await this._triggerHook('error', {
              actionId,
              timestamp: new Date(),
              user,
              errorType: 'input',
              message: inputErrorResult.message,
              error: validationResult.details,
            });

            return inputErrorResult;
          }

          parsedInput = validationResult.instance as TInput;
          this._log('debug', 'Input validation successful', { actionId });

          // Trigger afterValidation hook
          await this._triggerHook('afterValidation', {
            actionId,
            timestamp: new Date(),
            user,
            rawInput: input,
            validatedInput: parsedInput,
          });
        }

        // 3. Create context
        const context: ActionContext<TInput, TUser> = {
          parsedInput,
          user,
        };

        // 4. Execute handler with middlewares
        try {
          this._log('debug', 'Executing handler', { actionId });

          // Trigger beforeExecution hook
          await this._triggerHook('beforeExecution', {
            actionId,
            timestamp: new Date(),
            user,
            parsedInput,
          });

          const executeWithMiddlewares = async (): Promise<
            ActionResult<TOutput>
          > => {
            // Build middleware chain
            const execute = async (): Promise<TOutput> => {
              return await handler(context);
            };

            let chain: () => Promise<ActionResult<TOutput>> = async () => {
              const data = await execute();

              // Trigger afterExecution hook
              await this._triggerHook('afterExecution', {
                actionId,
                timestamp: new Date(),
                user,
                parsedInput,
                rawOutput: data,
              });

              // 5. Output validation
              if (this._outputDto) {
                this._log('debug', 'Validating output', { actionId });

                const outputValidationResult = await validateData(
                  this._outputDto as ClassConstructor<object>,
                  data,
                  'Invalid output',
                  this._validationOptions
                );

                if (!outputValidationResult.valid) {
                  this._log('error', 'Output validation failed', {
                    actionId,
                    errors: outputValidationResult.errors,
                    details: outputValidationResult.details,
                  });

                  const outputErrorResult = {
                    success: false,
                    error: 'output',
                    message: formatValidationErrors(
                      outputValidationResult.details
                    ),
                    details: outputValidationResult.details,
                  } as const;

                  // Trigger outputValidationError hook
                  await this._triggerHook('outputValidationError', {
                    actionId,
                    timestamp: new Date(),
                    user,
                    parsedInput,
                    rawOutput: data,
                    message: outputErrorResult.message,
                    details: outputValidationResult.details,
                  });

                  // Trigger generic error hook
                  await this._triggerHook('error', {
                    actionId,
                    timestamp: new Date(),
                    user,
                    errorType: 'output',
                    message: outputErrorResult.message,
                    error: outputValidationResult.details,
                    parsedInput,
                  });

                  return outputErrorResult;
                }

                this._log('debug', 'Output validation successful', {
                  actionId,
                });

                return {
                  success: true,
                  data: instanceToPlain(
                    outputValidationResult.instance
                  ) as TOutput,
                };
              }

              return { success: true, data };
            };

            // Apply middlewares in reverse order
            for (let i = this._middlewares.length - 1; i >= 0; i--) {
              const middleware = this._middlewares[i];
              const next = chain;
              chain = () => middleware(context, next);
            }

            return await chain();
          };

          const result = await executeWithMiddlewares();

          if (result.success) {
            this._log('info', 'Action completed successfully', { actionId });

            // Trigger success hook
            await this._triggerHook('success', {
              actionId,
              timestamp: new Date(),
              user,
              parsedInput,
              result,
              duration: Date.now() - startTime,
            });
          } else {
            this._log('warn', 'Action completed with error', {
              actionId,
              error: result.error,
              message: result.message,
            });
          }

          return result;
        } catch (error) {
          this._log('error', 'Handler execution error', {
            actionId,
            error: formatError(error),
            cause: error,
          });

          const serverErrorResult = {
            success: false,
            error: 'server',
            message: formatError(error),
            cause: error,
          } as const;

          // Trigger serverError hook
          await this._triggerHook('serverError', {
            actionId,
            timestamp: new Date(),
            user,
            parsedInput,
            message: serverErrorResult.message,
            cause: error,
            error,
          });

          // Trigger generic error hook
          await this._triggerHook('error', {
            actionId,
            timestamp: new Date(),
            user,
            errorType: 'server',
            message: serverErrorResult.message,
            error,
            parsedInput,
          });

          return serverErrorResult;
        }
      };

      // Apply retry logic if configured
      if (this._retryConfig) {
        this._log('debug', 'Executing with retry logic', {
          actionId,
          attempts: this._retryConfig.attempts,
        });

        let lastResult: ActionResult<TOutput> | undefined;
        let currentAttempt = 0;

        try {
          const executeWithRetryHook = async (): Promise<
            ActionResult<TOutput>
          > => {
            try {
              currentAttempt++;

              if (currentAttempt > 1 && this._retryConfig) {
                // Calculate delay for retry hook
                const delay =
                  this._retryConfig.backoff === 'exponential'
                    ? this._retryConfig.delay * Math.pow(2, currentAttempt - 2)
                    : this._retryConfig.delay * (currentAttempt - 1);

                // Trigger retry hook
                await this._triggerHook('retry', {
                  actionId,
                  timestamp: new Date(),
                  user: undefined,
                  attempt: currentAttempt,
                  maxAttempts: this._retryConfig.attempts,
                  delay,
                  error: lastResult,
                });
              }

              const result = await executeAction();

              // If the action succeeded, return the result
              if (result.success) {
                return result;
              }

              // Store the last error result
              lastResult = result;

              // For server errors, throw to trigger retry
              if (result.error === 'server') {
                throw new Error(result.message);
              }

              // For validation or auth errors, don't retry
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
            this._retryConfig
          );

          // Cache the result if configured
          if (cacheStorage && cacheKey) {
            const shouldCache =
              retryResult.success || (this._cacheConfig?.cacheErrors ?? false);

            if (shouldCache) {
              await cacheStorage.set(
                cacheKey,
                retryResult,
                this._cacheConfig?.ttl
              );
              this._log('debug', 'Result cached', { actionId, cacheKey });
            }
          }

          return retryResult;
        } catch (error) {
          this._log('error', 'All retry attempts failed', {
            actionId,
            error: formatError(error),
          });

          // Return the last result if we have one
          if (lastResult) {
            // Cache the error result if configured
            if (cacheStorage && cacheKey && this._cacheConfig?.cacheErrors) {
              await cacheStorage.set(
                cacheKey,
                lastResult,
                this._cacheConfig?.ttl
              );
              this._log('debug', 'Error result cached', { actionId, cacheKey });
            }
            return lastResult;
          }

          const errorResult = {
            success: false,
            error: 'server',
            message: formatError(error),
            cause: error,
          } as ActionResult<TOutput>;

          // Cache the error result if configured
          if (cacheStorage && cacheKey && this._cacheConfig?.cacheErrors) {
            await cacheStorage.set(
              cacheKey,
              errorResult,
              this._cacheConfig?.ttl
            );
            this._log('debug', 'Error result cached', { actionId, cacheKey });
          }

          return errorResult;
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

          await this._triggerHook('complete', {
            actionId,
            timestamp: new Date(),
            user: undefined,
            parsedInput: undefined,
            result: finalResult,
            duration,
          });
        }
      }

      const result = await executeAction();

      // Cache the result if configured
      if (cacheStorage && cacheKey) {
        const shouldCache =
          result.success || (this._cacheConfig?.cacheErrors ?? false);

        if (shouldCache) {
          await cacheStorage.set(cacheKey, result, this._cacheConfig?.ttl);
          this._log('debug', 'Result cached', { actionId, cacheKey });
        }
      }

      // Trigger complete hook for non-retry case
      const duration = Date.now() - startTime;
      await this._triggerHook('complete', {
        actionId,
        timestamp: new Date(),
        user: undefined,
        parsedInput: undefined,
        result,
        duration,
      });

      return result;
    };

    // If debouncing is configured, wrap the action function
    if (this._debounceConfig) {
      const debouncedFn = getOrCreateDebouncedAction(
        actionDefinitionId,
        coreActionFn,
        this._debounceConfig
      );
      // Cast to the expected return type (removes debounce-specific methods)
      return debouncedFn as (input?: unknown) => Promise<ActionResult<TOutput>>;
    }

    return coreActionFn;
  }

  /**
   * Internal logging helper
   * @private
   */
  private _log(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    meta?: Record<string, unknown>
  ): void {
    if (this._logger) {
      this._logger(level, message, meta);
    }
  }

  /**
   * Internal hook trigger helper
   * @private
   */
  private async _triggerHook(
    event: HookEvent,
    context: unknown
  ): Promise<void> {
    const callbacks = this._hooks[event] as HookCallback<unknown>[] | undefined;
    if (!callbacks || callbacks.length === 0) {
      return;
    }

    // Execute all hooks for this event
    for (const callback of callbacks) {
      try {
        await callback(context);
      } catch (error) {
        // Log hook errors but don't throw them
        this._log('error', `Hook "${event}" failed`, {
          error: formatError(error),
          cause: error,
        });
      }
    }
  }

  /**
   * Get the rate limit configuration (if set)
   * Useful for accessing metadata in middleware or external rate limiters
   */
  getRateLimitConfig(): RateLimitConfig | undefined {
    return this._rateLimitConfig;
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
