import 'reflect-metadata';
import type { ClassConstructor } from 'class-transformer';
import type { ValidatorOptions } from 'class-validator';
import type {
  ActionResult,
  ActionContext,
  AuthHandler,
  Middleware,
  Logger,
  RetryConfig,
  RateLimitConfig,
  ThrottleConfig,
  DebounceConfig,
  CacheConfig,
  HookCallbacks,
} from '../types';

/**
 * Internal builder state that holds all configuration
 */
export interface BuilderState<
  TInput = unknown,
  TOutput = unknown,
  TUser = unknown,
> {
  inputDto?: ClassConstructor<TInput>;
  outputDto?: ClassConstructor<TOutput>;
  authHandler?: AuthHandler<TUser>;
  middlewares: Middleware<
    ActionContext<TInput, TUser>,
    ActionResult<TOutput>
  >[];
  logger?: Logger;
  retryConfig?: RetryConfig;
  rateLimitConfig?: RateLimitConfig;
  throttleConfig?: ThrottleConfig<TInput, TUser>;
  debounceConfig?: DebounceConfig;
  cacheConfig?: CacheConfig<TInput>;
  validationOptions?: ValidatorOptions;
  hooks: Partial<HookCallbacks<TInput, TOutput, TUser>>;
}

/**
 * Configuration for creating a new builder instance
 */
export interface BuilderConfig<
  TInput = unknown,
  TOutput = unknown,
  TUser = unknown,
> {
  state: BuilderState<TInput, TOutput, TUser>;
}

/**
 * Context passed through the execution pipeline
 */
export interface ExecutionContext<TInput = unknown, TUser = unknown> {
  actionId: string;
  actionDefinitionId: string;
  startTime: number;
  input: unknown;
  parsedInput?: TInput;
  user?: TUser;
  isRetry?: boolean;
}
