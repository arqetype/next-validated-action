import 'reflect-metadata';
import { instanceToPlain, type ClassConstructor } from 'class-transformer';
import { ValidatorOptions } from 'class-validator';
import type {
  ActionResult,
  ActionContext,
  AuthHandler,
  ThrottleConfig,
} from '../types';
import { validateData, formatValidationErrors } from '../validation';
import { formatError } from '../utils';
import { checkThrottle, DEFAULT_THROTTLE_IDENTIFIER } from '../throttle';
import { HookManager, createBaseHookContext } from './hooks';
import { MiddlewareExecutor } from './middleware';

/**
 * Configuration for the action executor
 */
export interface ExecutorConfig<
  TInput = unknown,
  TOutput = unknown,
  TUser = unknown,
> {
  inputDto?: ClassConstructor<TInput>;
  outputDto?: ClassConstructor<TOutput>;
  authHandler?: AuthHandler<TUser>;
  middlewareExecutor: MiddlewareExecutor<TInput, TOutput, TUser>;
  hookManager: HookManager<TInput, TOutput, TUser>;
  validationOptions?: ValidatorOptions;
  throttleConfig?: ThrottleConfig<TInput, TUser>;
  actionDefinitionId?: string;
  logger?: (
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    meta?: Record<string, unknown>
  ) => void;
}

/**
 * Handles the core execution logic for actions including:
 * - Authentication
 * - Input validation
 * - Handler execution
 * - Output validation
 * - Middleware pipeline
 */
export class ActionExecutor<
  TInput = unknown,
  TOutput = unknown,
  TUser = unknown,
> {
  private inputDto?: ClassConstructor<TInput>;
  private outputDto?: ClassConstructor<TOutput>;
  private authHandler?: AuthHandler<TUser>;
  private middlewareExecutor: MiddlewareExecutor<TInput, TOutput, TUser>;
  private hookManager: HookManager<TInput, TOutput, TUser>;
  private validationOptions?: ValidatorOptions;
  private throttleConfig?: ThrottleConfig<TInput, TUser>;
  private actionDefinitionId?: string;
  private logger?: (
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    meta?: Record<string, unknown>
  ) => void;

  constructor(config: ExecutorConfig<TInput, TOutput, TUser>) {
    this.inputDto = config.inputDto;
    this.outputDto = config.outputDto;
    this.authHandler = config.authHandler;
    this.middlewareExecutor = config.middlewareExecutor;
    this.hookManager = config.hookManager;
    this.validationOptions = config.validationOptions;
    this.throttleConfig = config.throttleConfig;
    this.actionDefinitionId = config.actionDefinitionId;
    this.logger = config.logger;
  }

  /**
   * Execute the complete action pipeline
   */
  async execute(
    actionId: string,
    input: unknown,
    handler: (context: ActionContext<TInput, TUser>) => Promise<TOutput>,
    isRetry = false,
    startTime = Date.now()
  ): Promise<ActionResult<TOutput>> {
    // 1. Authentication
    const authResult = await this.executeAuthentication(actionId);
    if (!authResult.success) {
      return authResult.error;
    }
    const user = authResult.user;

    // 2. Input validation
    const validationResult = await this.executeInputValidation(
      actionId,
      input,
      user
    );
    if (!validationResult.success) {
      return validationResult.error;
    }
    const parsedInput = validationResult.parsedInput;

    // 3. Check throttle if configured (only on first attempt, not retries)
    if (this.throttleConfig && !isRetry && this.actionDefinitionId) {
      const throttleError = await this.checkThrottle(
        actionId,
        parsedInput,
        user
      );
      if (throttleError) {
        return throttleError;
      }
    }

    // 4. Create context
    const context: ActionContext<TInput, TUser> = {
      parsedInput,
      user,
    };

    // 5. Execute handler with middlewares
    return await this.executeHandler(
      actionId,
      context,
      handler,
      parsedInput,
      user,
      startTime
    );
  }

  /**
   * Execute authentication check
   */
  private async executeAuthentication(
    actionId: string
  ): Promise<
    | { success: true; user?: TUser }
    | { success: false; error: ActionResult<TOutput> }
  > {
    if (!this.authHandler) {
      return { success: true };
    }

    this.log('debug', 'Checking authentication', { actionId });

    try {
      const currentUser = await this.authHandler();

      if (!currentUser) {
        this.log('warn', 'Authentication failed - no user', { actionId });

        const authErrorResult = {
          success: false,
          error: 'auth',
          message: 'Authentication required',
        } as const;

        // Trigger authError hook
        await this.hookManager.triggerHook('authError', {
          ...createBaseHookContext(actionId, undefined),
          message: authErrorResult.message,
          error: new Error('Authentication required'),
        });

        // Trigger generic error hook
        await this.hookManager.triggerHook('error', {
          ...createBaseHookContext(actionId, undefined),
          errorType: 'auth',
          message: authErrorResult.message,
          error: new Error('Authentication required'),
        });

        return { success: false, error: authErrorResult };
      }

      this.log('debug', 'Authentication successful', { actionId });
      return { success: true, user: currentUser };
    } catch (error) {
      this.log('error', 'Authentication error', {
        actionId,
        error: formatError(error),
      });

      const authErrorResult = {
        success: false,
        error: 'auth',
        message: 'Authentication failed',
      } as const;

      // Trigger authError hook
      await this.hookManager.triggerHook('authError', {
        ...createBaseHookContext(actionId, undefined),
        message: authErrorResult.message,
        error,
      });

      // Trigger generic error hook
      await this.hookManager.triggerHook('error', {
        ...createBaseHookContext(actionId, undefined),
        errorType: 'auth',
        message: authErrorResult.message,
        error,
      });

      return { success: false, error: authErrorResult };
    }
  }

  /**
   * Execute input validation
   */
  private async executeInputValidation(
    actionId: string,
    input: unknown,
    user?: TUser
  ): Promise<
    | { success: true; parsedInput: TInput }
    | { success: false; error: ActionResult<TOutput> }
  > {
    let parsedInput: TInput = input as TInput;

    if (!this.inputDto) {
      return { success: true, parsedInput };
    }

    this.log('debug', 'Validating input', { actionId });

    // Trigger beforeValidation hook
    await this.hookManager.triggerHook('beforeValidation', {
      ...createBaseHookContext(actionId, user),
      rawInput: input,
    });

    const validationResult = await validateData(
      this.inputDto as ClassConstructor<object>,
      input,
      'Invalid input',
      this.validationOptions
    );

    if (!validationResult.valid) {
      this.log('warn', 'Input validation failed', {
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
      await this.hookManager.triggerHook('inputValidationError', {
        ...createBaseHookContext(actionId, user),
        rawInput: input,
        message: inputErrorResult.message,
        details: validationResult.details,
      });

      // Trigger generic error hook
      await this.hookManager.triggerHook('error', {
        ...createBaseHookContext(actionId, user),
        errorType: 'input',
        message: inputErrorResult.message,
        error: validationResult.details,
      });

      return { success: false, error: inputErrorResult };
    }

    parsedInput = validationResult.instance as TInput;
    this.log('debug', 'Input validation successful', { actionId });

    // Trigger afterValidation hook
    await this.hookManager.triggerHook('afterValidation', {
      ...createBaseHookContext(actionId, user),
      rawInput: input,
      validatedInput: parsedInput,
    });

    return { success: true, parsedInput };
  }

  /**
   * Execute handler with middleware pipeline
   */
  private async executeHandler(
    actionId: string,
    context: ActionContext<TInput, TUser>,
    handler: (context: ActionContext<TInput, TUser>) => Promise<TOutput>,
    parsedInput: TInput,
    user?: TUser,
    startTime?: number
  ): Promise<ActionResult<TOutput>> {
    try {
      this.log('debug', 'Executing handler', { actionId });

      // Trigger beforeExecution hook
      await this.hookManager.triggerHook('beforeExecution', {
        ...createBaseHookContext(actionId, user),
        parsedInput,
      });

      // Execute with middleware pipeline
      const result = await this.middlewareExecutor.execute(
        context,
        async () => {
          const data = await handler(context);

          // Trigger afterExecution hook
          await this.hookManager.triggerHook('afterExecution', {
            ...createBaseHookContext(actionId, user),
            parsedInput,
            rawOutput: data,
          });

          // Validate output
          return await this.validateOutput(actionId, data, parsedInput, user);
        }
      );

      if (result.success) {
        this.log('info', 'Action completed successfully', { actionId });

        // Trigger success hook
        await this.hookManager.triggerHook('success', {
          ...createBaseHookContext(actionId, user),
          parsedInput,
          result,
          duration: startTime ? Date.now() - startTime : 0,
        });
      } else {
        this.log('warn', 'Action completed with error', {
          actionId,
          error: result.error,
          message: result.message,
        });
      }

      return result;
    } catch (error) {
      this.log('error', 'Handler execution error', {
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
      await this.hookManager.triggerHook('serverError', {
        ...createBaseHookContext(actionId, user),
        parsedInput,
        message: serverErrorResult.message,
        cause: error,
        error,
      });

      // Trigger generic error hook
      await this.hookManager.triggerHook('error', {
        ...createBaseHookContext(actionId, user),
        errorType: 'server',
        message: serverErrorResult.message,
        error,
        parsedInput,
      });

      return serverErrorResult;
    }
  }

  /**
   * Validate output data
   */
  private async validateOutput(
    actionId: string,
    data: TOutput,
    parsedInput: TInput,
    user?: TUser
  ): Promise<ActionResult<TOutput>> {
    if (!this.outputDto) {
      return { success: true, data };
    }

    this.log('debug', 'Validating output', { actionId });

    const outputValidationResult = await validateData(
      this.outputDto as ClassConstructor<object>,
      data,
      'Invalid output',
      this.validationOptions
    );

    if (!outputValidationResult.valid) {
      this.log('error', 'Output validation failed', {
        actionId,
        errors: outputValidationResult.errors,
        details: outputValidationResult.details,
      });

      const outputErrorResult = {
        success: false,
        error: 'output',
        message: formatValidationErrors(outputValidationResult.details),
        details: outputValidationResult.details,
      } as const;

      // Trigger outputValidationError hook
      await this.hookManager.triggerHook('outputValidationError', {
        ...createBaseHookContext(actionId, user),
        parsedInput,
        rawOutput: data,
        message: outputErrorResult.message,
        details: outputValidationResult.details,
      });

      // Trigger generic error hook
      await this.hookManager.triggerHook('error', {
        ...createBaseHookContext(actionId, user),
        errorType: 'output',
        message: outputErrorResult.message,
        error: outputValidationResult.details,
        parsedInput,
      });

      return outputErrorResult;
    }

    this.log('debug', 'Output validation successful', { actionId });

    return {
      success: true,
      data: instanceToPlain(outputValidationResult.instance) as TOutput,
    };
  }

  /**
   * Internal logging helper
   */
  private log(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    meta?: Record<string, unknown>
  ): void {
    if (this.logger) {
      this.logger(level, message, meta);
    }
  }

  /**
   * Check throttle limits
   */
  private async checkThrottle(
    actionId: string,
    parsedInput: TInput,
    user?: TUser
  ): Promise<ActionResult<TOutput> | null> {
    if (!this.throttleConfig || !this.actionDefinitionId) {
      return null;
    }

    const identifier = this.throttleConfig.identifier
      ? this.throttleConfig.identifier({
          parsedInput,
          user,
          ip: undefined,
        })
      : DEFAULT_THROTTLE_IDENTIFIER();

    const throttleResult = checkThrottle(
      this.actionDefinitionId,
      identifier,
      this.throttleConfig
    );

    if (!throttleResult.allowed) {
      const resetTime = throttleResult.resetTime
        ? new Date(throttleResult.resetTime).toISOString()
        : 'unknown';
      const retryAfterMs = throttleResult.resetTime
        ? throttleResult.resetTime - Date.now()
        : 0;

      this.log('warn', 'Throttle limit exceeded', {
        actionId,
        identifier,
        current: throttleResult.current,
        limit: throttleResult.limit,
        resetTime,
      });

      const throttleErrorResult = {
        success: false,
        error: 'server',
        message: `Too many requests. Limit: ${throttleResult.limit} calls per ${this.throttleConfig.windowMs}ms. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`,
      } as const;

      // Trigger serverError hook for throttle
      await this.hookManager.triggerHook('serverError', {
        ...createBaseHookContext(actionId, user),
        parsedInput,
        message: throttleErrorResult.message,
        cause: new Error('Throttle limit exceeded'),
        error: new Error('Throttle limit exceeded'),
      });

      // Trigger generic error hook
      await this.hookManager.triggerHook('error', {
        ...createBaseHookContext(actionId, user),
        errorType: 'server',
        message: throttleErrorResult.message,
        error: new Error('Throttle limit exceeded'),
        parsedInput,
      });

      return throttleErrorResult;
    }

    this.log('debug', 'Throttle check passed', {
      actionId,
      identifier,
      remaining: throttleResult.remaining,
    });

    return null;
  }
}
