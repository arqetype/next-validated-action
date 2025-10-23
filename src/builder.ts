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
} from './types';
import { validateData, formatValidationErrors } from './validation';
import { withRetry, formatError } from './utils';

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
  private _validationOptions?: ValidatorOptions;

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
    validationOptions?: ValidatorOptions
  ) {
    this._inputDto = inputDto;
    this._outputDto = outputDto;
    this._authHandler = authHandler;
    this._middlewares = middlewares;
    this._logger = logger;
    this._retryConfig = retryConfig;
    this._rateLimitConfig = rateLimitConfig;
    this._validationOptions = validationOptions;
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
      this._validationOptions
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
      this._middlewares as Middleware<
        ActionContext<TInput, TUser>,
        ActionResult<TNewOutput>
      >[],
      this._logger,
      this._retryConfig,
      this._rateLimitConfig,
      this._validationOptions
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
      this._validationOptions
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
      this._validationOptions
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
      this._validationOptions
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
      this._validationOptions
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
      this._validationOptions
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
      options
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
    return async (input: unknown): Promise<ActionResult<TOutput>> => {
      const actionId = Math.random().toString(36).substring(7);

      this._log('info', 'Action started', { actionId, hasInput: !!input });

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
              return {
                success: false,
                error: 'auth',
                message: 'Authentication required',
              };
            }

            user = currentUser;
            this._log('debug', 'Authentication successful', { actionId });
          } catch (error) {
            this._log('error', 'Authentication error', {
              actionId,
              error: formatError(error),
            });
            return {
              success: false,
              error: 'auth',
              message: 'Authentication failed',
            };
          }
        }

        // 2. Input validation
        let parsedInput: TInput = input as TInput;

        if (this._inputDto) {
          this._log('debug', 'Validating input', { actionId });

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

            return {
              success: false,
              error: 'input',
              message: formatValidationErrors(validationResult.details),
              details: validationResult.details,
            };
          }

          parsedInput = validationResult.instance as TInput;
          this._log('debug', 'Input validation successful', { actionId });
        }

        // 3. Create context
        const context: ActionContext<TInput, TUser> = {
          parsedInput,
          user,
        };

        // 4. Execute handler with middlewares
        try {
          this._log('debug', 'Executing handler', { actionId });

          const executeWithMiddlewares = async (): Promise<
            ActionResult<TOutput>
          > => {
            // Build middleware chain
            const execute = async (): Promise<TOutput> => {
              return await handler(context);
            };

            let chain: () => Promise<ActionResult<TOutput>> = async () => {
              const data = await execute();

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

                  return {
                    success: false,
                    error: 'output',
                    message: formatValidationErrors(
                      outputValidationResult.details
                    ),
                    details: outputValidationResult.details,
                  };
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

          return {
            success: false,
            error: 'server',
            message: formatError(error),
            cause: error,
          };
        }
      };

      // Apply retry logic if configured
      if (this._retryConfig) {
        this._log('debug', 'Executing with retry logic', {
          actionId,
          attempts: this._retryConfig.attempts,
        });

        let lastResult: ActionResult<TOutput> | undefined;

        try {
          return await withRetry(async () => {
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
          }, this._retryConfig);
        } catch (error) {
          this._log('error', 'All retry attempts failed', {
            actionId,
            error: formatError(error),
          });

          // Return the last result if we have one
          if (lastResult) {
            return lastResult;
          }

          return {
            success: false,
            error: 'server',
            message: formatError(error),
            cause: error,
          };
        }
      }

      return await executeAction();
    };
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
