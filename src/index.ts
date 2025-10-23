import 'reflect-metadata';

// Export types
export type {
  ActionResult,
  ActionContext,
  AuthHandler,
  Middleware,
  Logger,
  RetryConfig,
  RateLimitConfig,
  ValidationOptions,
  ValidationError,
} from './types';

// Export builder
export { ActionClientBuilder, action } from './builder';

// Export type guards
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

// Export validation utilities
export { validateData, formatValidationErrors } from './validation';

// Export utility functions
export {
  withRetry,
  isRetriableError,
  formatError,
  deepClone,
  debounce,
  throttle,
} from './utils';
