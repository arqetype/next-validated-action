import 'reflect-metadata';

/**
 * This file maintains backward compatibility by re-exporting from the modular builder structure.
 * The original monolithic builder has been split into:
 * - builder/core.ts - Main ActionClientBuilder class and configuration methods
 * - builder/execution.ts - Action execution logic (auth, validation, handler execution)
 * - builder/hooks.ts - Hook management and triggering
 * - builder/middleware.ts - Middleware pipeline execution
 * - builder/types.ts - Shared types and interfaces
 */

export { ActionClientBuilder, action } from './builder/core';
export type {
  BuilderState,
  BuilderConfig,
  ExecutionContext,
} from './builder/types';
export { HookManager, createBaseHookContext } from './builder/hooks';
export { MiddlewareExecutor } from './builder/middleware';
export { ActionExecutor } from './builder/execution';
export type { ExecutorConfig } from './builder/execution';
