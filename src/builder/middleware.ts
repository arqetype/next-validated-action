import 'reflect-metadata';
import type { ActionContext, ActionResult, Middleware } from '../types';

/**
 * Manages middleware execution pipeline for actions
 */
export class MiddlewareExecutor<
  TInput = unknown,
  TOutput = unknown,
  TUser = unknown,
> {
  constructor(
    private middlewares: Middleware<
      ActionContext<TInput, TUser>,
      ActionResult<TOutput>
    >[]
  ) {}

  /**
   * Executes all middlewares in the correct order
   * Middlewares are applied in reverse order (last added runs first in the chain)
   *
   * @param context - The action context
   * @param finalHandler - The final handler to execute after all middlewares
   * @returns The result of the middleware chain execution
   */
  async execute(
    context: ActionContext<TInput, TUser>,
    finalHandler: () => Promise<ActionResult<TOutput>>
  ): Promise<ActionResult<TOutput>> {
    if (this.middlewares.length === 0) {
      return await finalHandler();
    }

    // Build middleware chain
    let chain: () => Promise<ActionResult<TOutput>> = finalHandler;

    // Apply middlewares in reverse order
    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const middleware = this.middlewares[i];
      const next = chain;
      chain = () => middleware(context, next);
    }

    return await chain();
  }

  /**
   * Get the number of registered middlewares
   */
  getMiddlewareCount(): number {
    return this.middlewares.length;
  }

  /**
   * Get all registered middlewares
   */
  getMiddlewares(): Middleware<
    ActionContext<TInput, TUser>,
    ActionResult<TOutput>
  >[] {
    return [...this.middlewares];
  }
}
