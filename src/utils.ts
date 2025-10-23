import type { RetryConfig } from './types';

/**
 * Executes a function with retry logic
 * @param fn - The function to execute
 * @param config - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't delay after the last attempt
      if (attempt < config.attempts) {
        const delay = calculateDelay(attempt, config);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Calculates the delay for a retry attempt
 * @param attempt - The current attempt number (1-indexed)
 * @param config - Retry configuration
 * @returns The delay in milliseconds
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const { delay, backoff = 'linear' } = config;

  if (backoff === 'exponential') {
    return delay * Math.pow(2, attempt - 1);
  }

  return delay * attempt;
}

/**
 * Sleeps for the specified duration
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if an error is retriable
 * @param error - The error to check
 * @returns True if the error should trigger a retry
 */
export function isRetriableError(error: unknown): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Timeout errors
  if (error instanceof Error && error.message.includes('timeout')) {
    return true;
  }

  // Add more retriable error patterns as needed
  return false;
}

/**
 * Formats an error into a user-friendly message
 * @param error - The error to format
 * @returns A formatted error message
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  return 'Unknown error';
}

/**
 * Deep clones an object (simple implementation)
 * @param obj - The object to clone
 * @returns A deep clone of the object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as T;
  }

  if (obj instanceof Object) {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }

  return obj;
}

/**
 * Creates a debounced version of a function
 * @param fn - The function to debounce
 * @param delay - The debounce delay in milliseconds
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Creates a throttled version of a function
 * @param fn - The function to throttle
 * @param delay - The throttle delay in milliseconds
 * @returns A throttled version of the function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return function (...args: Parameters<T>) {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}
