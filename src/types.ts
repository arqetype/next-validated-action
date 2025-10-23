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
 * Internal validation response
 * @internal
 */
export type ValidateResponse<T> =
  | { valid: false; errors: string[]; details: ValidationError[] }
  | { valid: true; instance: T };
