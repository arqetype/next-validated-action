import 'reflect-metadata';

export type {
  ActionResult,
  ActionContext,
  AuthHandler,
  Middleware,
  Logger,
  RetryConfig,
  RateLimitConfig,
  ThrottleConfig,
  DebounceConfig,
  ValidationOptions,
  ValidationError,
  CacheConfig,
  CacheStorage,
  HookEvent,
  HookCallback,
  HookCallbacks,
  BaseHookContext,
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

export { ActionClientBuilder, action } from './builder';

export {
  isSuccess,
  isError,
  isInputError,
  isServerError,
  isOutputError,
  isAuthError,
  unwrap,
  unwrapOr,
} from './guards';

export { validateData, formatValidationErrors } from './validation';

export { withRetry, isRetriableError, formatError, deepClone } from './utils';

export type { DebouncedFunction } from './debounce';

export {
  debounce,
  getOrCreateDebouncedAction,
  clearDebouncedAction,
  clearAllDebouncedActions,
} from './debounce';

export {
  MemoryCacheStorage,
  getGlobalMemoryCache,
  clearGlobalMemoryCache,
  generateDefaultCacheKey,
} from './cache';

export {
  checkThrottle,
  resetThrottle,
  resetAllThrottles,
  getThrottleState,
  DEFAULT_THROTTLE_IDENTIFIER,
} from './throttle';
