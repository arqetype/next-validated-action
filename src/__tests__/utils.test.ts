import 'reflect-metadata';
import {
  withRetry,
  isRetriableError,
  formatError,
  deepClone,
  debounce,
  throttle,
} from '../utils';

describe('withRetry', () => {
  it('should succeed on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');

    const result = await withRetry(fn, { attempts: 3, delay: 100 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    jest.setTimeout(10000);
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { attempts: 3, delay: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after all attempts fail', async () => {
    jest.setTimeout(10000);
    const error = new Error('always fails');
    const fn = jest.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { attempts: 3, delay: 10 })).rejects.toThrow(
      'always fails'
    );

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use linear backoff by default', async () => {
    jest.setTimeout(10000);
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const startTime = Date.now();

    try {
      await withRetry(fn, { attempts: 3, delay: 50 });
    } catch {
      // Expected to fail
    }

    const elapsed = Date.now() - startTime;
    // Should wait 50ms + 100ms = 150ms (with some tolerance)
    expect(elapsed).toBeGreaterThanOrEqual(150);
    expect(elapsed).toBeLessThan(300);
  });

  it('should use exponential backoff when configured', async () => {
    jest.setTimeout(10000);
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const startTime = Date.now();

    try {
      await withRetry(fn, { attempts: 3, delay: 50, backoff: 'exponential' });
    } catch {
      // Expected to fail
    }

    const elapsed = Date.now() - startTime;
    // Should wait 50ms + 100ms = 150ms (exponential: 50*2^0 + 50*2^1)
    expect(elapsed).toBeGreaterThanOrEqual(150);
    expect(elapsed).toBeLessThan(300);
  });

  it('should not delay after last attempt', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const startTime = Date.now();

    try {
      await withRetry(fn, { attempts: 1, delay: 1000 });
    } catch {
      // Expected to fail
    }

    const elapsed = Date.now() - startTime;
    // Should not wait 1000ms since there's only 1 attempt
    expect(elapsed).toBeLessThan(100);
  });
});

describe('isRetriableError', () => {
  it('should return true for fetch TypeError', () => {
    const error = new TypeError('fetch failed');

    expect(isRetriableError(error)).toBe(true);
  });

  it('should return true for timeout errors', () => {
    const error = new Error('Request timeout');

    expect(isRetriableError(error)).toBe(true);
  });

  it('should return false for regular errors', () => {
    const error = new Error('Regular error');

    expect(isRetriableError(error)).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isRetriableError('string error')).toBe(false);
    expect(isRetriableError(null)).toBe(false);
    expect(isRetriableError(undefined)).toBe(false);
  });
});

describe('formatError', () => {
  it('should format Error instances', () => {
    const error = new Error('Something went wrong');

    expect(formatError(error)).toBe('Something went wrong');
  });

  it('should format string errors', () => {
    expect(formatError('String error')).toBe('String error');
  });

  it('should format objects with message property', () => {
    const error = { message: 'Object error' };

    expect(formatError(error)).toBe('Object error');
  });

  it('should return default message for unknown types', () => {
    expect(formatError(null)).toBe('Unknown error');
    expect(formatError(undefined)).toBe('Unknown error');
    expect(formatError(123)).toBe('Unknown error');
    expect(formatError({})).toBe('Unknown error');
  });

  it('should handle objects with non-string message', () => {
    const error = { message: 123 };

    expect(formatError(error)).toBe('123');
  });
});

describe('deepClone', () => {
  it('should clone primitive values', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('string')).toBe('string');
    expect(deepClone(true)).toBe(true);
    expect(deepClone(null)).toBe(null);
    expect(deepClone(undefined)).toBe(undefined);
  });

  it('should clone simple objects', () => {
    const obj = { a: 1, b: 'two', c: true };
    const cloned = deepClone(obj);

    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
  });

  it('should clone nested objects', () => {
    const obj = {
      level1: {
        level2: {
          level3: 'deep',
        },
      },
    };
    const cloned = deepClone(obj);

    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
    expect(cloned.level1).not.toBe(obj.level1);
    expect(cloned.level1.level2).not.toBe(obj.level1.level2);
  });

  it('should clone arrays', () => {
    const arr = [1, 2, 3, 4, 5];
    const cloned = deepClone(arr);

    expect(cloned).toEqual(arr);
    expect(cloned).not.toBe(arr);
  });

  it('should clone nested arrays', () => {
    const arr = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];
    const cloned = deepClone(arr);

    expect(cloned).toEqual(arr);
    expect(cloned).not.toBe(arr);
    expect(cloned[0]).not.toBe(arr[0]);
  });

  it('should clone Date objects', () => {
    const date = new Date('2024-01-01');
    const cloned = deepClone(date);

    expect(cloned.getTime()).toBe(date.getTime());
    expect(cloned).not.toBe(date);
  });

  it('should clone mixed structures', () => {
    const complex = {
      number: 42,
      string: 'test',
      array: [1, 2, { nested: true }],
      object: {
        deep: {
          value: 'hello',
        },
      },
      date: new Date('2024-01-01'),
    };
    const cloned = deepClone(complex);

    expect(cloned).toEqual(complex);
    expect(cloned).not.toBe(complex);
    expect(cloned.array).not.toBe(complex.array);
    expect(cloned.object).not.toBe(complex.object);
    expect(cloned.date).not.toBe(complex.date);
  });

  it('should not share references after cloning', () => {
    const original = { nested: { value: 1 } };
    const cloned = deepClone(original);

    cloned.nested.value = 2;

    expect(original.nested.value).toBe(1);
    expect(cloned.nested.value).toBe(2);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should delay function execution', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should reset timer on subsequent calls', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    jest.advanceTimersByTime(50);
    debounced();
    jest.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(50);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to the function', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced('arg1', 'arg2', 123);

    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 123);
  });

  it('should only execute once for multiple rapid calls', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();
    debounced();

    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should execute function immediately on first call', async () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);

    throttled();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should prevent execution within throttle window', async () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);

    throttled();
    await new Promise((resolve) => setTimeout(resolve, 50));
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);
  }, 10000);

  it('should allow execution after throttle window', async () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);

    throttled();
    await new Promise((resolve) => setTimeout(resolve, 150));
    throttled();

    expect(fn).toHaveBeenCalledTimes(2);
  }, 10000);

  it('should pass arguments to the function', async () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);

    throttled('arg1', 'arg2');

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should ignore calls within throttle window', async () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);

    throttled('call1');
    await new Promise((resolve) => setTimeout(resolve, 25));
    throttled('call2');
    await new Promise((resolve) => setTimeout(resolve, 25));
    throttled('call3');
    await new Promise((resolve) => setTimeout(resolve, 60));
    throttled('call4');

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'call1');
    expect(fn).toHaveBeenNthCalledWith(2, 'call4');
  }, 10000);
});
