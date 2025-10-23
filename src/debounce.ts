import type { DebounceConfig } from './types';

/**
 * Debounced function interface
 */
export interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  (
    ...args: Parameters<T>
  ): ReturnType<T> extends Promise<unknown>
    ? ReturnType<T>
    : Promise<ReturnType<T>>;
  cancel(): void;
  flush(): ReturnType<T> extends Promise<infer U>
    ? Promise<U | undefined>
    : Promise<ReturnType<T> | undefined>;
  pending(): boolean;
}

/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified delay has elapsed since the last time it was invoked.
 *
 * @template T - The function type to debounce
 * @param func - The function to debounce
 * @param config - Debounce configuration
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: unknown[]) => Promise<unknown>>(
  func: T,
  config: DebounceConfig
): DebouncedFunction<T> {
  const { delay, leading = false, trailing = true, maxWait } = config;

  let timeoutId: NodeJS.Timeout | undefined;
  let maxWaitTimeoutId: NodeJS.Timeout | undefined;
  let lastInvokeTime = 0;
  let lastCallTime = 0;
  let lastArgs: Parameters<T> | undefined;
  let lastThis: unknown;
  let result: ReturnType<T> | undefined;
  let pendingPromises: Array<{
    resolve: (value: ReturnType<T>) => void;
    reject: (reason?: unknown) => void;
  }> = [];

  const invokeFunc = async (): Promise<ReturnType<T>> => {
    if (!lastArgs) {
      throw new Error('No arguments to invoke');
    }
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = undefined;
    lastThis = undefined;
    lastInvokeTime = Date.now();

    try {
      const funcResult = (await func.apply(thisArg, args)) as ReturnType<T>;
      result = funcResult;
      // Resolve all pending promises with the result
      pendingPromises.forEach((p) => p.resolve(funcResult));
      pendingPromises = [];
      return funcResult;
    } catch (error) {
      // Reject all pending promises with the error
      pendingPromises.forEach((p) => p.reject(error));
      pendingPromises = [];
      throw error;
    }
  };

  const shouldInvoke = (time: number): boolean => {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    // First call
    return (
      lastCallTime === 0 ||
      // Enough time has passed since last call
      timeSinceLastCall >= delay ||
      // Max wait exceeded
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  };

  const remainingWait = (time: number): number => {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = delay - timeSinceLastCall;

    if (maxWait !== undefined) {
      const maxWaitRemaining = maxWait - timeSinceLastInvoke;
      return Math.min(timeWaiting, maxWaitRemaining);
    }

    return timeWaiting;
  };

  const cancelTimers = (): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    if (maxWaitTimeoutId) {
      clearTimeout(maxWaitTimeoutId);
      maxWaitTimeoutId = undefined;
    }
  };

  const timerExpired = (): void => {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge();
    }
    // Restart timer with remaining wait
    timeoutId = setTimeout(timerExpired, remainingWait(time));
  };

  const trailingEdge = (): void => {
    timeoutId = undefined;

    if (trailing && lastArgs !== undefined) {
      invokeFunc().catch(() => {
        // Error already handled in invokeFunc
      });
    } else {
      lastArgs = undefined;
      lastThis = undefined;
    }
  };

  const leadingEdge = (): void => {
    lastInvokeTime = Date.now();
    // Start the timer for the trailing edge
    timeoutId = setTimeout(timerExpired, delay);

    if (leading) {
      invokeFunc().catch(() => {
        // Error already handled in invokeFunc
      });
    }
  };

  const debounced = function (
    this: unknown,
    ...args: Parameters<T>
  ): Promise<ReturnType<T>> {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastThis = this;
    lastCallTime = time;

    return new Promise<ReturnType<T>>((resolve, reject) => {
      pendingPromises.push({ resolve, reject });

      if (isInvoking) {
        if (timeoutId === undefined) {
          leadingEdge();
        }
      } else {
        // Not invoking yet, restart timer
        cancelTimers();
        timeoutId = setTimeout(timerExpired, remainingWait(time));
      }
    });
  };

  debounced.cancel = (): void => {
    cancelTimers();
    lastArgs = undefined;
    lastThis = undefined;
    lastInvokeTime = 0;
    lastCallTime = 0;
    // Reject all pending promises
    pendingPromises.forEach((p) =>
      p.reject(new Error('Debounced function cancelled'))
    );
    pendingPromises = [];
  };

  debounced.flush = async (): Promise<ReturnType<T> | undefined> => {
    cancelTimers();
    if (lastArgs !== undefined) {
      return await invokeFunc();
    }
    return result;
  };

  debounced.pending = (): boolean => {
    return timeoutId !== undefined || lastArgs !== undefined;
  };

  return debounced as DebouncedFunction<T>;
}

/**
 * Global storage for debounced action instances
 * This allows debouncing to work across multiple calls to the same action
 */
const debouncedActions = new Map<
  string,
  DebouncedFunction<(...args: unknown[]) => Promise<unknown>>
>();

/**
 * Gets or creates a debounced version of an action
 *
 * @param actionId - Unique identifier for the action
 * @param func - The function to debounce
 * @param config - Debounce configuration
 * @returns A debounced version of the function
 */
export function getOrCreateDebouncedAction<
  T extends (...args: unknown[]) => Promise<unknown>,
>(actionId: string, func: T, config: DebounceConfig): DebouncedFunction<T> {
  if (!debouncedActions.has(actionId)) {
    debouncedActions.set(actionId, debounce(func, config));
  }
  return debouncedActions.get(actionId) as DebouncedFunction<T>;
}

/**
 * Clears a debounced action from the global storage
 *
 * @param actionId - Unique identifier for the action
 */
export function clearDebouncedAction(actionId: string): void {
  const debouncedAction = debouncedActions.get(actionId);
  if (debouncedAction) {
    try {
      debouncedAction.cancel();
    } catch {
      // Ignore cancellation errors during cleanup
    }
    debouncedActions.delete(actionId);
  }
}

/**
 * Clears all debounced actions from the global storage
 */
export function clearAllDebouncedActions(): void {
  debouncedActions.forEach((action) => {
    try {
      action.cancel();
    } catch {
      // Ignore cancellation errors during cleanup
    }
  });
  debouncedActions.clear();
}
