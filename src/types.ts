import 'reflect-metadata';

/**
 * Detailed validation error for a single field
 */
export type ValidationError = {
  field: string;
  constraints: string[];
};

/**
 * Result type for all server actions
 * @template T - The type of the success data
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: 'input';
      message: string;
      details?: ValidationError[];
    }
  | {
      success: false;
      error: 'server';
      message: string;
      cause?: unknown;
    }
  | {
      success: false;
      error: 'output';
      message: string;
      details?: ValidationError[];
    }
  | { success: false; error: 'auth'; message: string };

/**
 * Context passed to action handlers
 * @template TInput - The validated input type
 * @template TUser - The user type (if authenticated)
 */
export type ActionContext<TInput = unknown, TUser = unknown> = {
  parsedInput: TInput;
  user?: TUser;
};

/**
 * Authentication handler function
 * @template TUser - The user type to return
 * @returns The authenticated user or null/undefined if not authenticated
 */
export type AuthHandler<TUser = unknown> = () => Promise<
  TUser | null | undefined
>;

/**
 * Middleware function that can intercept and modify action execution
 * @template TContext - The action context type
 * @template TResult - The action result type
 */
export type Middleware<TContext = unknown, TResult = unknown> = (
  context: TContext,
  next: () => Promise<TResult>
) => Promise<TResult>;

/**
 * Logger function for observability
 */
export type Logger = (
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  meta?: Record<string, unknown>
) => void;

/**
 * Retry configuration
 */
export type RetryConfig = {
  attempts: number;
  delay: number;
  backoff?: 'linear' | 'exponential';
};

/**
 * Rate limiting configuration
 */
export type RateLimitConfig = {
  maxCalls: number;
  windowMs: number;
};

/**
 * Debounce configuration
 */
export type DebounceConfig = {
  /**
   * Delay in milliseconds before executing the action
   */
  delay: number;
  /**
   * Execute on the leading edge of the timeout
   * Default: false
   */
  leading?: boolean;
  /**
   * Execute on the trailing edge of the timeout
   * Default: true
   */
  trailing?: boolean;
  /**
   * Maximum time the action can be delayed before it's invoked
   */
  maxWait?: number;
};

/**
 * Validation options passed to class-validator
 */
export type ValidationOptions = {
  skipMissingProperties?: boolean;
  whitelist?: boolean;
  forbidNonWhitelisted?: boolean;
  forbidUnknownValues?: boolean;
  stopAtFirstError?: boolean;
};

/**
 * Cache storage interface for storing cached results
 */
export interface CacheStorage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

/**
 * Cache configuration
 */
export type CacheConfig<TInput = unknown> = {
  /**
   * Time to live in milliseconds
   */
  ttl?: number;
  /**
   * Cache key generator function
   * If not provided, a default key generator will be used
   */
  key?: (input: TInput) => string;
  /**
   * Storage backend for cache
   * Default: 'memory'
   */
  storage?: CacheStorage | 'memory';
  /**
   * Whether to cache errors
   * Default: false
   */
  cacheErrors?: boolean;
};

/**
 * Internal validation response
 * @internal
 */
export type ValidateResponse<T> =
  | { valid: false; errors: string[]; details: ValidationError[] }
  | { valid: true; instance: T };

/**
 * Hook event names
 */
export type HookEvent =
  | 'beforeValidation'
  | 'afterValidation'
  | 'beforeExecution'
  | 'afterExecution'
  | 'success'
  | 'error'
  | 'authError'
  | 'inputValidationError'
  | 'outputValidationError'
  | 'serverError'
  | 'retry'
  | 'complete';

/**
 * Base context available in all hooks
 */
export type BaseHookContext<TUser = unknown> = {
  actionId: string;
  timestamp: Date;
  user?: TUser;
};

/**
 * Context for beforeValidation hook
 */
export type BeforeValidationContext<TUser = unknown> =
  BaseHookContext<TUser> & {
    rawInput: unknown;
  };

/**
 * Context for afterValidation hook
 */
export type AfterValidationContext<
  TInput = unknown,
  TUser = unknown,
> = BaseHookContext<TUser> & {
  rawInput: unknown;
  validatedInput: TInput;
};

/**
 * Context for beforeExecution hook
 */
export type BeforeExecutionContext<
  TInput = unknown,
  TUser = unknown,
> = BaseHookContext<TUser> & {
  parsedInput: TInput;
};

/**
 * Context for afterExecution hook
 */
export type AfterExecutionContext<
  TInput = unknown,
  TOutput = unknown,
  TUser = unknown,
> = BaseHookContext<TUser> & {
  parsedInput: TInput;
  rawOutput: TOutput;
};

/**
 * Context for success hook
 */
export type SuccessContext<
  TInput = unknown,
  TOutput = unknown,
  TUser = unknown,
> = BaseHookContext<TUser> & {
  parsedInput: TInput;
  result: { success: true; data: TOutput };
  duration: number;
};

/**
 * Context for generic error hook
 */
export type ErrorContext<
  TInput = unknown,
  TUser = unknown,
> = BaseHookContext<TUser> & {
  errorType: 'auth' | 'input' | 'output' | 'server';
  message: string;
  error: unknown;
  parsedInput?: TInput;
};

/**
 * Context for authError hook
 */
export type AuthErrorContext<TUser = unknown> = BaseHookContext<TUser> & {
  message: string;
  error: unknown;
};

/**
 * Context for inputValidationError hook
 */
export type InputValidationErrorContext<TUser = unknown> =
  BaseHookContext<TUser> & {
    rawInput: unknown;
    message: string;
    details: ValidationError[];
  };

/**
 * Context for outputValidationError hook
 */
export type OutputValidationErrorContext<
  TInput = unknown,
  TUser = unknown,
> = BaseHookContext<TUser> & {
  parsedInput: TInput;
  rawOutput: unknown;
  message: string;
  details: ValidationError[];
};

/**
 * Context for serverError hook
 */
export type ServerErrorContext<
  TInput = unknown,
  TUser = unknown,
> = BaseHookContext<TUser> & {
  parsedInput?: TInput;
  message: string;
  cause: unknown;
  error: unknown;
};

/**
 * Context for retry hook
 */
export type RetryContext<TUser = unknown> = BaseHookContext<TUser> & {
  attempt: number;
  maxAttempts: number;
  delay: number;
  error: unknown;
};

/**
 * Context for complete hook
 */
export type CompleteContext<
  TInput = unknown,
  TOutput = unknown,
  TUser = unknown,
> = BaseHookContext<TUser> & {
  parsedInput?: TInput;
  result: ActionResult<TOutput>;
  duration: number;
};

/**
 * Hook callback function type
 */
export type HookCallback<TContext = unknown> = (
  context: TContext
) => void | Promise<void>;

/**
 * Map of hook events to their callback arrays
 */
export type HookCallbacks<
  TInput = unknown,
  TOutput = unknown,
  TUser = unknown,
> = {
  beforeValidation: HookCallback<BeforeValidationContext<TUser>>[];
  afterValidation: HookCallback<AfterValidationContext<TInput, TUser>>[];
  beforeExecution: HookCallback<BeforeExecutionContext<TInput, TUser>>[];
  afterExecution: HookCallback<AfterExecutionContext<TInput, TOutput, TUser>>[];
  success: HookCallback<SuccessContext<TInput, TOutput, TUser>>[];
  error: HookCallback<ErrorContext<TInput, TUser>>[];
  authError: HookCallback<AuthErrorContext<TUser>>[];
  inputValidationError: HookCallback<InputValidationErrorContext<TUser>>[];
  outputValidationError: HookCallback<
    OutputValidationErrorContext<TInput, TUser>
  >[];
  serverError: HookCallback<ServerErrorContext<TInput, TUser>>[];
  retry: HookCallback<RetryContext<TUser>>[];
  complete: HookCallback<CompleteContext<TInput, TOutput, TUser>>[];
};
