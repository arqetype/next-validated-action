import type { ThrottleConfig } from './types';

/**
 * Throttle state for tracking calls
 */
interface ThrottleState {
  calls: number;
  windowStart: number;
  callTimestamps?: number[]; // For sliding window
}

/**
 * Global storage for throttle states per action and identifier
 */
const throttleStates = new Map<string, Map<string, ThrottleState>>();

/**
 * Cleans up expired throttle states to prevent memory leaks
 */
function cleanupExpiredStates(
  actionId: string,
  windowMs: number,
  now: number
): void {
  const actionStates = throttleStates.get(actionId);
  if (!actionStates) return;

  const keysToDelete: string[] = [];
  actionStates.forEach((state, identifier) => {
    if (now - state.windowStart > windowMs * 2) {
      keysToDelete.push(identifier);
    }
  });

  keysToDelete.forEach((key) => actionStates.delete(key));
}

/**
 * Checks if a call is allowed under fixed window strategy
 */
function isAllowedFixedWindow(
  state: ThrottleState,
  maxCalls: number,
  windowMs: number,
  now: number
): { allowed: boolean; resetTime?: number } {
  const windowElapsed = now - state.windowStart;

  // If window has expired, reset the state
  if (windowElapsed >= windowMs) {
    state.calls = 1;
    state.windowStart = now;
    return { allowed: true };
  }

  // Within the current window
  if (state.calls < maxCalls) {
    state.calls++;
    return { allowed: true };
  }

  // Throttled - return when the window resets
  const resetTime = state.windowStart + windowMs;
  return { allowed: false, resetTime };
}

/**
 * Checks if a call is allowed under sliding window strategy
 */
function isAllowedSlidingWindow(
  state: ThrottleState,
  maxCalls: number,
  windowMs: number,
  now: number
): { allowed: boolean; resetTime?: number } {
  if (!state.callTimestamps) {
    state.callTimestamps = [];
  }

  // Remove timestamps outside the current window
  state.callTimestamps = state.callTimestamps.filter(
    (timestamp) => now - timestamp < windowMs
  );

  // Check if we're under the limit
  if (state.callTimestamps.length < maxCalls) {
    state.callTimestamps.push(now);
    state.calls = state.callTimestamps.length;
    return { allowed: true };
  }

  // Throttled - return when the oldest call expires
  const oldestCall = state.callTimestamps[0];
  const resetTime = oldestCall + windowMs;
  return { allowed: false, resetTime };
}

/**
 * Checks if an action call should be throttled
 *
 * @param actionId - Unique identifier for the action
 * @param identifier - Identifier for the throttle scope (user ID, IP, etc.)
 * @param config - Throttle configuration
 * @returns Object indicating if the call is allowed and when it will reset
 */
export function checkThrottle<TInput = unknown, TUser = unknown>(
  actionId: string,
  identifier: string,
  config: ThrottleConfig<TInput, TUser>
): {
  allowed: boolean;
  resetTime?: number;
  current: number;
  limit: number;
  remaining: number;
} {
  const { maxCalls, windowMs, strategy = 'fixed' } = config;
  const now = Date.now();

  // Clean up old states periodically
  cleanupExpiredStates(actionId, windowMs, now);

  // Get or create action-specific state map
  if (!throttleStates.has(actionId)) {
    throttleStates.set(actionId, new Map());
  }

  const actionStates = throttleStates.get(actionId);
  if (!actionStates) {
    throw new Error('Failed to create action state map');
  }

  // Get or create state for this identifier
  if (!actionStates.has(identifier)) {
    actionStates.set(identifier, {
      calls: 0,
      windowStart: now,
      callTimestamps: strategy === 'sliding' ? [] : undefined,
    });
  }

  const state = actionStates.get(identifier);
  if (!state) {
    throw new Error('Failed to create throttle state');
  }

  // Check throttle based on strategy
  const result =
    strategy === 'sliding'
      ? isAllowedSlidingWindow(state, maxCalls, windowMs, now)
      : isAllowedFixedWindow(state, maxCalls, windowMs, now);

  const remaining = Math.max(0, maxCalls - state.calls);

  return {
    allowed: result.allowed,
    resetTime: result.resetTime,
    current: state.calls,
    limit: maxCalls,
    remaining,
  };
}

/**
 * Resets throttle state for a specific action and identifier
 *
 * @param actionId - Unique identifier for the action
 * @param identifier - Identifier for the throttle scope
 */
export function resetThrottle(actionId: string, identifier?: string): void {
  if (!identifier) {
    // Reset all identifiers for this action
    throttleStates.delete(actionId);
    return;
  }

  const actionStates = throttleStates.get(actionId);
  if (actionStates) {
    actionStates.delete(identifier);
  }
}

/**
 * Resets all throttle states
 */
export function resetAllThrottles(): void {
  throttleStates.clear();
}

/**
 * Gets the current throttle state for debugging
 *
 * @param actionId - Unique identifier for the action
 * @param identifier - Identifier for the throttle scope
 */
export function getThrottleState(
  actionId: string,
  identifier: string
): {
  calls: number;
  windowStart: number;
  age: number;
} | null {
  const actionStates = throttleStates.get(actionId);
  if (!actionStates) return null;

  const state = actionStates.get(identifier);
  if (!state) return null;

  return {
    calls: state.calls,
    windowStart: state.windowStart,
    age: Date.now() - state.windowStart,
  };
}

/**
 * Default identifier function that returns a global identifier
 */
export const DEFAULT_THROTTLE_IDENTIFIER = (): string => '__global__';
