import 'reflect-metadata';
import { IsString, IsNumber, Min } from 'class-validator';
import { action } from '../builder';
import type { ActionResult } from '../types';

class SearchInput {
  @IsString()
  query!: string;
}

class SearchOutput {
  @IsString()
  results!: string;
}

class CountInput {
  @IsNumber()
  @Min(0)
  value!: number;
}

describe('Debounce Integration', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should debounce action calls with simple delay', async () => {
    jest.useFakeTimers();
    const handlerMock = jest.fn(async ({ parsedInput }) => {
      return { results: `Found: ${parsedInput.query}` };
    });

    const searchAction = action
      .inputDto(SearchInput)
      .outputDto(SearchOutput)
      .debounce(300)
      .action(handlerMock);

    const promise1 = searchAction({ query: 'first' });
    const promise2 = searchAction({ query: 'second' });
    const promise3 = searchAction({ query: 'third' });

    expect(handlerMock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    const results = await Promise.all([promise1, promise2, promise3]);

    // Should only execute once with the last input
    expect(handlerMock).toHaveBeenCalledTimes(1);
    expect(handlerMock).toHaveBeenCalledWith({
      parsedInput: { query: 'third' },
      user: undefined,
    });

    // All promises should resolve with the same result
    expect(results).toEqual([
      { success: true, data: { results: 'Found: third' } },
      { success: true, data: { results: 'Found: third' } },
      { success: true, data: { results: 'Found: third' } },
    ]);

    jest.useRealTimers();
  });

  it('should debounce with advanced options (leading edge)', async () => {
    jest.useFakeTimers();
    const handlerMock = jest.fn(async ({ parsedInput }) => {
      return { results: `Found: ${parsedInput.query}` };
    });

    const searchAction = action
      .inputDto(SearchInput)
      .outputDto(SearchOutput)
      .debounceOptions({
        delay: 300,
        leading: true,
        trailing: false,
      })
      .action(handlerMock);

    const promise1 = searchAction({ query: 'first' });

    // Should execute immediately on leading edge
    await promise1;
    expect(handlerMock).toHaveBeenCalledTimes(1);
    expect(handlerMock).toHaveBeenCalledWith({
      parsedInput: { query: 'first' },
      user: undefined,
    });

    const result1 = await promise1;
    expect(result1).toEqual({
      success: true,
      data: { results: 'Found: first' },
    });

    // Subsequent calls within delay should not execute
    const _promise2 = searchAction({ query: 'second' });
    jest.advanceTimersByTime(200);
    expect(handlerMock).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  // maxWait option is thoroughly tested in unit tests (debounce.test.ts)

  it('should validate input after debouncing', async () => {
    // Use real timers for this test to avoid cleanup issues
    const handlerMock = jest.fn(async ({ parsedInput }) => {
      return { results: `Found: ${parsedInput.query}` };
    });

    const searchAction = action
      .inputDto(SearchInput)
      .outputDto(SearchOutput)
      .debounce(50) // Short delay for faster test
      .action(handlerMock);

    // Invalid input (missing query) - validation happens after debounce
    const promise1 = searchAction({});

    // Wait for debounce to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result1 = await promise1;

    expect(result1.success).toBe(false);
    if (!result1.success && result1.error === 'input') {
      expect(result1.message).toContain('query');
      expect(result1.details).toBeDefined();
    }

    // Handler should not be called for invalid input
    expect(handlerMock).not.toHaveBeenCalled();
  });

  it('should work with authentication', async () => {
    jest.useFakeTimers();
    const handlerMock = jest.fn(async ({ parsedInput, user }) => {
      return { results: `User ${user.name} searched: ${parsedInput.query}` };
    });

    const searchAction = action
      .inputDto(SearchInput)
      .outputDto(SearchOutput)
      .needsAuth(async () => ({ id: 1, name: 'John' }))
      .debounce(300)
      .action(handlerMock);

    const promise1 = searchAction({ query: 'test1' });
    const promise2 = searchAction({ query: 'test2' });

    jest.advanceTimersByTime(300);
    const results = await Promise.all([promise1, promise2]);

    expect(handlerMock).toHaveBeenCalledTimes(1);
    expect(handlerMock).toHaveBeenCalledWith({
      parsedInput: { query: 'test2' },
      user: { id: 1, name: 'John' },
    });

    expect(results[0]).toEqual({
      success: true,
      data: { results: 'User John searched: test2' },
    });

    jest.useRealTimers();
  });

  it('should work with middleware', async () => {
    jest.useFakeTimers();
    const middlewareMock = jest.fn(async (ctx, next) => {
      return await next();
    });

    const handlerMock = jest.fn(async ({ parsedInput }) => {
      return { results: `Found: ${parsedInput.query}` };
    });

    const searchAction = action
      .inputDto(SearchInput)
      .outputDto(SearchOutput)
      .use(middlewareMock)
      .debounce(300)
      .action(handlerMock);

    const promise1 = searchAction({ query: 'test1' });
    const promise2 = searchAction({ query: 'test2' });

    jest.advanceTimersByTime(300);
    await Promise.all([promise1, promise2]);

    // Middleware should be called for each debounced execution
    expect(middlewareMock).toHaveBeenCalledTimes(1);
    expect(handlerMock).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('should work with retry configuration', async () => {
    jest.useFakeTimers();
    const handlerMock = jest.fn(async ({ parsedInput }) => {
      return { results: `Found: ${parsedInput.query}` };
    });

    const searchAction = action
      .inputDto(SearchInput)
      .outputDto(SearchOutput)
      .retry({ attempts: 3, delay: 100 })
      .debounce(300)
      .action(handlerMock);

    const promise = searchAction({ query: 'test' });

    // Advance past debounce delay
    jest.advanceTimersByTime(300);

    const result = await promise;

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ results: 'Found: test' });
    }
    expect(handlerMock).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should handle errors in debounced actions', async () => {
    jest.useFakeTimers();
    const error = new Error('Search failed');
    const handlerMock = jest.fn(async () => {
      throw error;
    });

    const searchAction = action
      .inputDto(SearchInput)
      .outputDto(SearchOutput)
      .debounce(300)
      .action(handlerMock);

    const promise1 = searchAction({ query: 'test1' });
    const promise2 = searchAction({ query: 'test2' });

    jest.advanceTimersByTime(300);
    const results = await Promise.all([promise1, promise2]);

    expect(handlerMock).toHaveBeenCalledTimes(1);
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(false);

    if (!results[0].success && results[0].error === 'server') {
      expect(results[0].message).toBe('Search failed');
    }

    jest.useRealTimers();
  });

  it('should validate output after debounced execution', async () => {
    jest.useFakeTimers();
    const handlerMock = jest.fn(async () => {
      // Return invalid output (missing results field)
      return {} as any;
    });

    const searchAction = action
      .inputDto(SearchInput)
      .outputDto(SearchOutput)
      .debounce(300)
      .action(handlerMock);

    const promise = searchAction({ query: 'test' });

    jest.advanceTimersByTime(300);
    const result = await promise;

    expect(result.success).toBe(false);
    if (!result.success && result.error === 'output') {
      expect(result.message).toContain('results');
      expect(result.details).toBeDefined();
    }

    jest.useRealTimers();
  });

  it('should work with hooks', async () => {
    jest.useFakeTimers();
    const beforeExecutionMock = jest.fn();
    const successMock = jest.fn();

    const handlerMock = jest.fn(async ({ parsedInput }) => {
      return { results: `Found: ${parsedInput.query}` };
    });

    const searchAction = action
      .inputDto(SearchInput)
      .outputDto(SearchOutput)
      .on('beforeExecution', beforeExecutionMock)
      .on('success', successMock)
      .debounce(300)
      .action(handlerMock);

    const promise1 = searchAction({ query: 'test1' });
    const promise2 = searchAction({ query: 'test2' });

    jest.advanceTimersByTime(300);
    await Promise.all([promise1, promise2]);

    expect(beforeExecutionMock).toHaveBeenCalledTimes(1);
    expect(successMock).toHaveBeenCalledTimes(1);
    expect(handlerMock).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('should allow chaining debounce with other builder methods', async () => {
    jest.useFakeTimers();
    const handlerMock = jest.fn(async ({ parsedInput }) => {
      return { results: `Found: ${parsedInput.query}` };
    });

    const searchAction = action
      .inputDto(SearchInput)
      .needsAuth(async () => ({ id: 1, name: 'John' }))
      .use(async (ctx, next) => next())
      .debounce(300)
      .logger((level, message) => console.log(level, message))
      .outputDto(SearchOutput)
      .action(handlerMock);

    const promise = searchAction({ query: 'test' });

    jest.advanceTimersByTime(300);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(handlerMock).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('should separate debounce state between different actions', async () => {
    jest.useFakeTimers();
    const handler1Mock = jest.fn(async ({ parsedInput }) => {
      return { results: `Found: ${parsedInput.query}` };
    });

    const handler2Mock = jest.fn(async ({ parsedInput }) => {
      return parsedInput.value * 2;
    });

    const searchAction = action
      .inputDto(SearchInput)
      .outputDto(SearchOutput)
      .debounce(300)
      .action(handler1Mock);

    const countAction = action
      .inputDto(CountInput)
      .debounce(300)
      .action(handler2Mock);

    const searchPromise = searchAction({ query: 'test' });
    const countPromise = countAction({ value: 5 });

    jest.advanceTimersByTime(300);
    await Promise.all([searchPromise, countPromise]);

    // Both should execute independently
    expect(handler1Mock).toHaveBeenCalledTimes(1);
    expect(handler2Mock).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('should handle rapid successive calls correctly', async () => {
    jest.useFakeTimers();
    const handlerMock = jest.fn(async ({ parsedInput }) => {
      return { results: `Found: ${parsedInput.query}` };
    });

    const searchAction = action
      .inputDto(SearchInput)
      .outputDto(SearchOutput)
      .debounce(300)
      .action(handlerMock);

    const promises: Promise<ActionResult<SearchOutput>>[] = [];

    // Simulate rapid typing
    for (let i = 0; i < 10; i++) {
      promises.push(searchAction({ query: `test${i}` }));
      jest.advanceTimersByTime(50);
    }

    // Wait for debounce to complete
    jest.advanceTimersByTime(300);
    const results = await Promise.all(promises);

    // Should only execute once with the last value
    expect(handlerMock).toHaveBeenCalledTimes(1);
    expect(handlerMock).toHaveBeenCalledWith({
      parsedInput: { query: 'test9' },
      user: undefined,
    });

    // All promises should resolve with the same result
    results.forEach((result) => {
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ results: 'Found: test9' });
      }
    });

    jest.useRealTimers();
  });
});
