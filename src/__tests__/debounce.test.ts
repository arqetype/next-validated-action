import {
  debounce,
  getOrCreateDebouncedAction,
  clearDebouncedAction,
  clearAllDebouncedActions,
} from '../debounce';
import type { DebounceConfig } from '../types';

describe('debounce', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  afterEach(() => {
    clearAllDebouncedActions();
  });

  it('should debounce function calls with trailing edge', async () => {
    jest.useFakeTimers();
    const mockFn = jest.fn(async (value: string) => value.toUpperCase());
    const config: DebounceConfig = { delay: 300, trailing: true };
    const debouncedFn = debounce(
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );

    const promise1 = debouncedFn('hello');
    const promise2 = debouncedFn('world');
    const promise3 = debouncedFn('test');

    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    await Promise.all([promise1, promise2, promise3]);

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('test');

    const results = await Promise.all([promise1, promise2, promise3]);
    expect(results).toEqual(['TEST', 'TEST', 'TEST']);

    jest.useRealTimers();
  });

  it('should execute on leading edge when configured', async () => {
    jest.useFakeTimers();
    const mockFn = jest.fn(async (value: string) => value.toUpperCase());
    const config: DebounceConfig = {
      delay: 300,
      leading: true,
      trailing: false,
    };
    const debouncedFn = debounce(
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );

    const promise1 = debouncedFn('hello');

    // Should execute immediately on leading edge
    await promise1;
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('hello');
    expect(await promise1).toBe('HELLO');

    // Subsequent calls within delay should not execute
    debouncedFn('world');
    jest.advanceTimersByTime(200);
    expect(mockFn).toHaveBeenCalledTimes(1);

    // After delay, next call should execute on leading edge
    jest.advanceTimersByTime(100);
    const promise3 = debouncedFn('test');
    await promise3;
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenCalledWith('test');

    jest.useRealTimers();
  });

  it('should execute on both leading and trailing edges when configured', async () => {
    jest.useFakeTimers();
    const mockFn = jest.fn(async (value: string) => value.toUpperCase());
    const config: DebounceConfig = {
      delay: 300,
      leading: true,
      trailing: true,
    };
    const debouncedFn = debounce(
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );

    const promise1 = debouncedFn('hello');
    await promise1;
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('hello');

    const promise2 = debouncedFn('world');
    jest.advanceTimersByTime(300);
    await promise2;

    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenCalledWith('world');

    jest.useRealTimers();
  });

  it('should respect maxWait option', async () => {
    jest.useFakeTimers();
    const mockFn = jest.fn(async (value: string) => value.toUpperCase());
    const config: DebounceConfig = {
      delay: 500,
      maxWait: 1000,
      trailing: true,
    };
    const debouncedFn = debounce(
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );

    // Call multiple times within maxWait
    debouncedFn('a');
    jest.advanceTimersByTime(400);
    debouncedFn('b');
    jest.advanceTimersByTime(400);
    debouncedFn('c');
    jest.advanceTimersByTime(200);
    // Total: 1000ms, should trigger maxWait

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('c');

    jest.useRealTimers();
  });

  it('should cancel pending invocations', async () => {
    jest.useFakeTimers();
    const mockFn = jest.fn(async (value: string) => value.toUpperCase());
    const config: DebounceConfig = { delay: 300, trailing: true };
    const debouncedFn = debounce(
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );

    const promise1 = debouncedFn('hello');
    const promise2 = debouncedFn('world');

    debouncedFn.cancel();

    jest.advanceTimersByTime(300);

    await expect(promise1).rejects.toThrow('Debounced function cancelled');
    await expect(promise2).rejects.toThrow('Debounced function cancelled');
    expect(mockFn).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should flush pending invocations', async () => {
    jest.useFakeTimers();
    const mockFn = jest.fn(async (value: string) => value.toUpperCase());
    const config: DebounceConfig = { delay: 300, trailing: true };
    const debouncedFn = debounce(
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );

    const promise1 = debouncedFn('hello');
    const promise2 = debouncedFn('world');

    const result = await debouncedFn.flush();

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('world');
    expect(result).toBe('WORLD');

    const results = await Promise.all([promise1, promise2]);
    expect(results).toEqual(['WORLD', 'WORLD']);

    jest.useRealTimers();
  });

  it('should report pending status correctly', () => {
    jest.useFakeTimers();
    const mockFn = jest.fn(async (value: string) => value.toUpperCase());
    const config: DebounceConfig = { delay: 300, trailing: true };
    const debouncedFn = debounce(
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );

    expect(debouncedFn.pending()).toBe(false);

    debouncedFn('hello');
    expect(debouncedFn.pending()).toBe(true);

    jest.advanceTimersByTime(300);
    expect(debouncedFn.pending()).toBe(false);

    jest.useRealTimers();
  });

  it('should handle errors correctly', async () => {
    jest.useFakeTimers();
    const error = new Error('Test error');
    const mockFn = jest.fn(async (value: string) => {
      if (value === 'error') throw error;
      return value.toUpperCase();
    });
    const config: DebounceConfig = { delay: 300, trailing: true };
    const debouncedFn = debounce(
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );

    const promise1 = debouncedFn('error');
    const promise2 = debouncedFn('error');

    jest.advanceTimersByTime(300);

    await expect(promise1).rejects.toThrow('Test error');
    await expect(promise2).rejects.toThrow('Test error');
    expect(mockFn).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('should allow multiple separate debounced functions', async () => {
    jest.useFakeTimers();
    const mockFn1 = jest.fn(async (value: string) => value.toUpperCase());
    const mockFn2 = jest.fn(async (value: number) => value * 2);
    const config: DebounceConfig = { delay: 300, trailing: true };

    const debouncedFn1 = debounce(
      mockFn1 as (...args: unknown[]) => Promise<unknown>,
      config
    );
    const debouncedFn2 = debounce(
      mockFn2 as (...args: unknown[]) => Promise<unknown>,
      config
    );

    debouncedFn1('hello');
    debouncedFn2(5);

    jest.advanceTimersByTime(300);

    expect(mockFn1).toHaveBeenCalledTimes(1);
    expect(mockFn1).toHaveBeenCalledWith('hello');
    expect(mockFn2).toHaveBeenCalledTimes(1);
    expect(mockFn2).toHaveBeenCalledWith(5);

    jest.useRealTimers();
  });
});

describe('getOrCreateDebouncedAction', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    clearAllDebouncedActions();
  });

  afterEach(() => {
    clearAllDebouncedActions();
  });

  it('should return the same debounced function for the same action ID', () => {
    const mockFn = jest.fn(async (value: string) => value.toUpperCase());
    const config: DebounceConfig = { delay: 300 };

    const debouncedFn1 = getOrCreateDebouncedAction(
      'action-1',
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );
    const debouncedFn2 = getOrCreateDebouncedAction(
      'action-1',
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );

    expect(debouncedFn1).toBe(debouncedFn2);
  });

  it('should return different debounced functions for different action IDs', () => {
    const mockFn = jest.fn(async (value: string) => value.toUpperCase());
    const config: DebounceConfig = { delay: 300 };

    const debouncedFn1 = getOrCreateDebouncedAction(
      'action-1',
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );
    const debouncedFn2 = getOrCreateDebouncedAction(
      'action-2',
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );

    expect(debouncedFn1).not.toBe(debouncedFn2);
  });

  it('should share debounced state across calls with same action ID', async () => {
    jest.useFakeTimers();
    const mockFn = jest.fn(async (value: string) => value.toUpperCase());
    const config: DebounceConfig = { delay: 300, trailing: true };

    const debouncedFn1 = getOrCreateDebouncedAction(
      'action-1',
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );
    const debouncedFn2 = getOrCreateDebouncedAction(
      'action-1',
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );

    debouncedFn1('hello');
    debouncedFn2('world');

    jest.advanceTimersByTime(300);

    // Should only execute once with the last value
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('world');

    jest.useRealTimers();
  });
});

describe('clearDebouncedAction', () => {
  beforeEach(() => {
    clearAllDebouncedActions();
  });

  it('should clear a specific debounced action', () => {
    const mockFn = jest.fn(async (value: string) => value.toUpperCase());
    const config: DebounceConfig = { delay: 300 };

    const debouncedFn1 = getOrCreateDebouncedAction(
      'action-1',
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );
    clearDebouncedAction('action-1');
    const debouncedFn2 = getOrCreateDebouncedAction(
      'action-1',
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );

    expect(debouncedFn1).not.toBe(debouncedFn2);
  });

  it('should cancel pending invocations when clearing', async () => {
    jest.useFakeTimers();
    const mockFn = jest.fn(async (value: string) => value.toUpperCase());
    const config: DebounceConfig = { delay: 300, trailing: true };

    const debouncedFn = getOrCreateDebouncedAction(
      'action-1',
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );
    const promise = debouncedFn('hello');

    clearDebouncedAction('action-1');

    await expect(promise).rejects.toThrow('Debounced function cancelled');
    expect(mockFn).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});

describe('clearAllDebouncedActions', () => {
  it('should clear all debounced actions', () => {
    const mockFn = jest.fn(async (value: string) => value.toUpperCase());
    const config: DebounceConfig = { delay: 300 };

    const debouncedFn1 = getOrCreateDebouncedAction(
      'action-1',
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );
    const debouncedFn2 = getOrCreateDebouncedAction(
      'action-2',
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );

    clearAllDebouncedActions();

    const newDebouncedFn1 = getOrCreateDebouncedAction(
      'action-1',
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );
    const newDebouncedFn2 = getOrCreateDebouncedAction(
      'action-2',
      mockFn as (...args: unknown[]) => Promise<unknown>,
      config
    );

    expect(debouncedFn1).not.toBe(newDebouncedFn1);
    expect(debouncedFn2).not.toBe(newDebouncedFn2);
  });

  it('should cancel all pending invocations', async () => {
    jest.useFakeTimers();
    const mockFn1 = jest.fn(async (value: string) => value.toUpperCase());
    const mockFn2 = jest.fn(async (value: number) => value * 2);
    const config: DebounceConfig = { delay: 300, trailing: true };

    const debouncedFn1 = getOrCreateDebouncedAction(
      'action-1',
      mockFn1 as (...args: unknown[]) => Promise<unknown>,
      config
    );
    const debouncedFn2 = getOrCreateDebouncedAction(
      'action-2',
      mockFn2 as (...args: unknown[]) => Promise<unknown>,
      config
    );

    const promise1 = debouncedFn1('hello');
    const promise2 = debouncedFn2(5);

    clearAllDebouncedActions();

    await expect(promise1).rejects.toThrow('Debounced function cancelled');
    await expect(promise2).rejects.toThrow('Debounced function cancelled');
    expect(mockFn1).not.toHaveBeenCalled();
    expect(mockFn2).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});
