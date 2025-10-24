import 'reflect-metadata';
import type {
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
} from '../types';
import { formatError } from '../utils';

/**
 * Manages hook registration and execution for actions
 */
export class HookManager<TInput = unknown, TOutput = unknown, TUser = unknown> {
  constructor(
    private hooks: Partial<HookCallbacks<TInput, TOutput, TUser>>,
    private logger?: (
      level: 'info' | 'warn' | 'error' | 'debug',
      message: string,
      meta?: Record<string, unknown>
    ) => void
  ) {}

  /**
   * Register a new hook callback
   */
  registerHook<E extends HookEvent>(
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
  ): Partial<HookCallbacks<TInput, TOutput, TUser>> {
    const newHooks = { ...this.hooks };
    const existingCallbacks = (newHooks[event] ||
      []) as HookCallback<unknown>[];
    (newHooks[event] as HookCallback<unknown>[]) = [
      ...existingCallbacks,
      callback as HookCallback<unknown>,
    ];
    return newHooks;
  }

  /**
   * Trigger all hooks for a specific event
   */
  async triggerHook(event: HookEvent, context: unknown): Promise<void> {
    const callbacks = this.hooks[event] as HookCallback<unknown>[] | undefined;
    if (!callbacks || callbacks.length === 0) {
      return;
    }

    // Execute all hooks for this event
    for (const callback of callbacks) {
      try {
        await callback(context);
      } catch (error) {
        // Log hook errors but don't throw them
        if (this.logger) {
          this.logger('error', `Hook "${event}" failed`, {
            error: formatError(error),
            cause: error,
          });
        }
      }
    }
  }

  /**
   * Get all registered hooks
   */
  getHooks(): Partial<HookCallbacks<TInput, TOutput, TUser>> {
    return this.hooks;
  }
}

/**
 * Helper to create hook contexts
 */
export function createBaseHookContext<TUser = unknown>(
  actionId: string,
  user?: TUser
): { actionId: string; timestamp: Date; user?: TUser } {
  return {
    actionId,
    timestamp: new Date(),
    user,
  };
}
