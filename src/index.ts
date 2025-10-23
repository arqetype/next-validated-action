import 'reflect-metadata';

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

export {
  withRetry,
  isRetriableError,
  formatError,
  deepClone,
  debounce,
  throttle,
} from './utils';
