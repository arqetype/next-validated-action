import type { ActionResult } from './types';

/**
 * Type guard to check if an action result is successful
 * @param result - The action result to check
 * @returns True if the result is successful
 * @example
 * ```ts
 * const result = await myAction({ data: 'test' });
 * if (isSuccess(result)) {
 *   console.log(result.data); // TypeScript knows this is the success type
 * }
 * ```
 */
export function isSuccess<T>(
  result: ActionResult<T>
): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard to check if an action result is an error
 * @param result - The action result to check
 * @returns True if the result is an error
 * @example
 * ```ts
 * const result = await myAction({ data: 'test' });
 * if (isError(result)) {
 *   console.error(result.message); // TypeScript knows this is an error type
 * }
 * ```
 */
export function isError<T>(
  result: ActionResult<T>
): result is Extract<ActionResult<T>, { success: false }> {
  return result.success === false;
}

/**
 * Type guard to check if an action result is an input validation error
 * @param result - The action result to check
 * @returns True if the result is an input validation error
 */
export function isInputError<T>(
  result: ActionResult<T>
): result is Extract<ActionResult<T>, { success: false; error: 'input' }> {
  return result.success === false && result.error === 'input';
}

/**
 * Type guard to check if an action result is a server error
 * @param result - The action result to check
 * @returns True if the result is a server error
 */
export function isServerError<T>(
  result: ActionResult<T>
): result is Extract<ActionResult<T>, { success: false; error: 'server' }> {
  return result.success === false && result.error === 'server';
}

/**
 * Type guard to check if an action result is an output validation error
 * @param result - The action result to check
 * @returns True if the result is an output validation error
 */
export function isOutputError<T>(
  result: ActionResult<T>
): result is Extract<ActionResult<T>, { success: false; error: 'output' }> {
  return result.success === false && result.error === 'output';
}

/**
 * Type guard to check if an action result is an authentication error
 * @param result - The action result to check
 * @returns True if the result is an authentication error
 */
export function isAuthError<T>(
  result: ActionResult<T>
): result is Extract<ActionResult<T>, { success: false; error: 'auth' }> {
  return result.success === false && result.error === 'auth';
}

/**
 * Unwraps a successful result or throws an error
 * @param result - The action result to unwrap
 * @returns The data if successful
 * @throws Error if the result is not successful
 * @example
 * ```ts
 * try {
 *   const data = unwrap(await myAction({ data: 'test' }));
 *   console.log(data); // TypeScript knows this is T
 * } catch (error) {
 *   console.error(error);
 * }
 * ```
 */
export function unwrap<T>(result: ActionResult<T>): T {
  if (result.success) {
    return result.data;
  }
  throw new Error(result.message);
}

/**
 * Unwraps a successful result or returns a default value
 * @param result - The action result to unwrap
 * @param defaultValue - The default value to return if the result is not successful
 * @returns The data if successful, otherwise the default value
 * @example
 * ```ts
 * const data = unwrapOr(await myAction({ data: 'test' }), { fallback: true });
 * ```
 */
export function unwrapOr<T>(result: ActionResult<T>, defaultValue: T): T {
  if (result.success) {
    return result.data;
  }
  return defaultValue;
}
