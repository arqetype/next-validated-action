import {
  checkThrottle,
  resetThrottle,
  resetAllThrottles,
  getThrottleState,
  DEFAULT_THROTTLE_IDENTIFIER,
} from '../throttle';
import type { ThrottleConfig } from '../types';

describe('Throttle', () => {
  beforeEach(() => {
    resetAllThrottles();
    jest.clearAllTimers();
  });

  describe('checkThrottle - Fixed Window Strategy', () => {
    it('should allow calls within the limit', () => {
      const config: ThrottleConfig = {
        maxCalls: 3,
        windowMs: 1000,
        strategy: 'fixed',
      };

      const result1 = checkThrottle('action1', 'user1', config);
      expect(result1.allowed).toBe(true);
      expect(result1.current).toBe(1);
      expect(result1.remaining).toBe(2);

      const result2 = checkThrottle('action1', 'user1', config);
      expect(result2.allowed).toBe(true);
      expect(result2.current).toBe(2);
      expect(result2.remaining).toBe(1);

      const result3 = checkThrottle('action1', 'user1', config);
      expect(result3.allowed).toBe(true);
      expect(result3.current).toBe(3);
      expect(result3.remaining).toBe(0);
    });

    it('should block calls exceeding the limit', () => {
      const config: ThrottleConfig = {
        maxCalls: 2,
        windowMs: 1000,
        strategy: 'fixed',
      };

      checkThrottle('action1', 'user1', config);
      checkThrottle('action1', 'user1', config);

      const result = checkThrottle('action1', 'user1', config);
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(2);
      expect(result.remaining).toBe(0);
      expect(result.resetTime).toBeDefined();
    });

    it('should reset after window expires', async () => {
      const config: ThrottleConfig = {
        maxCalls: 2,
        windowMs: 100,
        strategy: 'fixed',
      };

      const result1 = checkThrottle('action1', 'user1', config);
      expect(result1.allowed).toBe(true);

      const result2 = checkThrottle('action1', 'user1', config);
      expect(result2.allowed).toBe(true);

      const result3 = checkThrottle('action1', 'user1', config);
      expect(result3.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result4 = checkThrottle('action1', 'user1', config);
      expect(result4.allowed).toBe(true);
      expect(result4.current).toBe(1);
    });

    it('should track different identifiers separately', () => {
      const config: ThrottleConfig = {
        maxCalls: 1,
        windowMs: 1000,
        strategy: 'fixed',
      };

      const result1 = checkThrottle('action1', 'user1', config);
      expect(result1.allowed).toBe(true);

      const result2 = checkThrottle('action1', 'user2', config);
      expect(result2.allowed).toBe(true);

      const result3 = checkThrottle('action1', 'user1', config);
      expect(result3.allowed).toBe(false);

      const result4 = checkThrottle('action1', 'user2', config);
      expect(result4.allowed).toBe(false);
    });

    it('should track different actions separately', () => {
      const config: ThrottleConfig = {
        maxCalls: 1,
        windowMs: 1000,
        strategy: 'fixed',
      };

      const result1 = checkThrottle('action1', 'user1', config);
      expect(result1.allowed).toBe(true);

      const result2 = checkThrottle('action2', 'user1', config);
      expect(result2.allowed).toBe(true);

      const result3 = checkThrottle('action1', 'user1', config);
      expect(result3.allowed).toBe(false);

      const result4 = checkThrottle('action2', 'user1', config);
      expect(result4.allowed).toBe(false);
    });
  });

  describe('checkThrottle - Sliding Window Strategy', () => {
    it('should allow calls within the limit', () => {
      const config: ThrottleConfig = {
        maxCalls: 3,
        windowMs: 1000,
        strategy: 'sliding',
      };

      const result1 = checkThrottle('action1', 'user1', config);
      expect(result1.allowed).toBe(true);
      expect(result1.current).toBe(1);
      expect(result1.remaining).toBe(2);

      const result2 = checkThrottle('action1', 'user1', config);
      expect(result2.allowed).toBe(true);
      expect(result2.current).toBe(2);
      expect(result2.remaining).toBe(1);

      const result3 = checkThrottle('action1', 'user1', config);
      expect(result3.allowed).toBe(true);
      expect(result3.current).toBe(3);
      expect(result3.remaining).toBe(0);
    });

    it('should block calls exceeding the limit', () => {
      const config: ThrottleConfig = {
        maxCalls: 2,
        windowMs: 1000,
        strategy: 'sliding',
      };

      checkThrottle('action1', 'user1', config);
      checkThrottle('action1', 'user1', config);

      const result = checkThrottle('action1', 'user1', config);
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(2);
      expect(result.remaining).toBe(0);
      expect(result.resetTime).toBeDefined();
    });

    it('should allow new calls after oldest call expires', async () => {
      const config: ThrottleConfig = {
        maxCalls: 2,
        windowMs: 100,
        strategy: 'sliding',
      };

      // First call at T=0
      const result1 = checkThrottle('action1', 'user1', config);
      expect(result1.allowed).toBe(true);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Second call at T=50
      const result2 = checkThrottle('action1', 'user1', config);
      expect(result2.allowed).toBe(true);

      // Third call at T=50 (should be blocked)
      const result3 = checkThrottle('action1', 'user1', config);
      expect(result3.allowed).toBe(false);

      // Wait for first call to expire (T=110)
      await new Promise((resolve) => setTimeout(resolve, 70));

      // Fourth call should be allowed (first call expired)
      const result4 = checkThrottle('action1', 'user1', config);
      expect(result4.allowed).toBe(true);
    });

    it('should remove expired timestamps from the window', async () => {
      const config: ThrottleConfig = {
        maxCalls: 3,
        windowMs: 100,
        strategy: 'sliding',
      };

      // Make 3 calls
      checkThrottle('action1', 'user1', config);
      checkThrottle('action1', 'user1', config);
      checkThrottle('action1', 'user1', config);

      // Verify blocked
      const blockedResult = checkThrottle('action1', 'user1', config);
      expect(blockedResult.allowed).toBe(false);

      // Wait for all to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // All calls should be allowed again
      const result1 = checkThrottle('action1', 'user1', config);
      expect(result1.allowed).toBe(true);
      expect(result1.current).toBe(1);

      const result2 = checkThrottle('action1', 'user1', config);
      expect(result2.allowed).toBe(true);
      expect(result2.current).toBe(2);

      const result3 = checkThrottle('action1', 'user1', config);
      expect(result3.allowed).toBe(true);
      expect(result3.current).toBe(3);
    });
  });

  describe('resetThrottle', () => {
    it('should reset throttle state for a specific identifier', () => {
      const config: ThrottleConfig = {
        maxCalls: 1,
        windowMs: 1000,
        strategy: 'fixed',
      };

      const result1 = checkThrottle('action1', 'user1', config);
      expect(result1.allowed).toBe(true);

      const result2 = checkThrottle('action1', 'user1', config);
      expect(result2.allowed).toBe(false);

      resetThrottle('action1', 'user1');

      const result3 = checkThrottle('action1', 'user1', config);
      expect(result3.allowed).toBe(true);
    });

    it('should reset all identifiers for an action when no identifier provided', () => {
      const config: ThrottleConfig = {
        maxCalls: 1,
        windowMs: 1000,
        strategy: 'fixed',
      };

      checkThrottle('action1', 'user1', config);
      checkThrottle('action1', 'user2', config);

      const result1 = checkThrottle('action1', 'user1', config);
      expect(result1.allowed).toBe(false);

      const result2 = checkThrottle('action1', 'user2', config);
      expect(result2.allowed).toBe(false);

      resetThrottle('action1');

      const result3 = checkThrottle('action1', 'user1', config);
      expect(result3.allowed).toBe(true);

      const result4 = checkThrottle('action1', 'user2', config);
      expect(result4.allowed).toBe(true);
    });

    it('should not affect other actions', () => {
      const config: ThrottleConfig = {
        maxCalls: 1,
        windowMs: 1000,
        strategy: 'fixed',
      };

      checkThrottle('action1', 'user1', config);
      checkThrottle('action2', 'user1', config);

      resetThrottle('action1', 'user1');

      const result1 = checkThrottle('action1', 'user1', config);
      expect(result1.allowed).toBe(true);

      const result2 = checkThrottle('action2', 'user1', config);
      expect(result2.allowed).toBe(false);
    });
  });

  describe('resetAllThrottles', () => {
    it('should reset all throttle states', () => {
      const config: ThrottleConfig = {
        maxCalls: 1,
        windowMs: 1000,
        strategy: 'fixed',
      };

      checkThrottle('action1', 'user1', config);
      checkThrottle('action2', 'user2', config);

      const result1 = checkThrottle('action1', 'user1', config);
      expect(result1.allowed).toBe(false);

      const result2 = checkThrottle('action2', 'user2', config);
      expect(result2.allowed).toBe(false);

      resetAllThrottles();

      const result3 = checkThrottle('action1', 'user1', config);
      expect(result3.allowed).toBe(true);

      const result4 = checkThrottle('action2', 'user2', config);
      expect(result4.allowed).toBe(true);
    });
  });

  describe('getThrottleState', () => {
    it('should return current throttle state', () => {
      const config: ThrottleConfig = {
        maxCalls: 3,
        windowMs: 1000,
        strategy: 'fixed',
      };

      const before = Date.now();
      checkThrottle('action1', 'user1', config);
      checkThrottle('action1', 'user1', config);

      const state = getThrottleState('action1', 'user1');
      expect(state).not.toBeNull();
      expect(state?.calls).toBe(2);
      expect(state?.windowStart).toBeGreaterThanOrEqual(before);
      expect(state?.age).toBeGreaterThanOrEqual(0);
    });

    it('should return null for non-existent action', () => {
      const state = getThrottleState('nonexistent', 'user1');
      expect(state).toBeNull();
    });

    it('should return null for non-existent identifier', () => {
      const config: ThrottleConfig = {
        maxCalls: 3,
        windowMs: 1000,
        strategy: 'fixed',
      };

      checkThrottle('action1', 'user1', config);

      const state = getThrottleState('action1', 'user2');
      expect(state).toBeNull();
    });
  });

  describe('DEFAULT_THROTTLE_IDENTIFIER', () => {
    it('should return a global identifier', () => {
      const identifier = DEFAULT_THROTTLE_IDENTIFIER();
      expect(identifier).toBe('__global__');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very short windows correctly', async () => {
      const config: ThrottleConfig = {
        maxCalls: 2,
        windowMs: 10,
        strategy: 'fixed',
      };

      const result1 = checkThrottle('action1', 'user1', config);
      expect(result1.allowed).toBe(true);

      const result2 = checkThrottle('action1', 'user1', config);
      expect(result2.allowed).toBe(true);

      const result3 = checkThrottle('action1', 'user1', config);
      expect(result3.allowed).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 20));

      const result4 = checkThrottle('action1', 'user1', config);
      expect(result4.allowed).toBe(true);
    });

    it('should handle very large limits correctly', () => {
      const config: ThrottleConfig = {
        maxCalls: 1000,
        windowMs: 1000,
        strategy: 'fixed',
      };

      for (let i = 0; i < 1000; i++) {
        const result = checkThrottle('action1', 'user1', config);
        expect(result.allowed).toBe(true);
      }

      const result = checkThrottle('action1', 'user1', config);
      expect(result.allowed).toBe(false);
    });

    it('should calculate resetTime correctly for fixed window', () => {
      const config: ThrottleConfig = {
        maxCalls: 1,
        windowMs: 1000,
        strategy: 'fixed',
      };

      const before = Date.now();
      checkThrottle('action1', 'user1', config);
      const result = checkThrottle('action1', 'user1', config);

      expect(result.allowed).toBe(false);
      expect(result.resetTime).toBeDefined();
      expect(result.resetTime).toBeGreaterThan(before);
      expect(result.resetTime).toBeLessThanOrEqual(before + 1000 + 10); // Small buffer for timing
    });

    it('should calculate resetTime correctly for sliding window', () => {
      const config: ThrottleConfig = {
        maxCalls: 1,
        windowMs: 1000,
        strategy: 'sliding',
      };

      const before = Date.now();
      checkThrottle('action1', 'user1', config);
      const result = checkThrottle('action1', 'user1', config);

      expect(result.allowed).toBe(false);
      expect(result.resetTime).toBeDefined();
      expect(result.resetTime).toBeGreaterThan(before);
      expect(result.resetTime).toBeLessThanOrEqual(before + 1000 + 10); // Small buffer for timing
    });

    it('should handle concurrent calls correctly', () => {
      const config: ThrottleConfig = {
        maxCalls: 5,
        windowMs: 1000,
        strategy: 'fixed',
      };

      const results = Array.from({ length: 10 }, () =>
        checkThrottle('action1', 'user1', config)
      );

      const allowedCount = results.filter((r) => r.allowed).length;
      const blockedCount = results.filter((r) => !r.allowed).length;

      expect(allowedCount).toBe(5);
      expect(blockedCount).toBe(5);
    });
  });

  describe('Strategy Comparison', () => {
    it('should handle burst traffic differently between fixed and sliding', async () => {
      const fixedConfig: ThrottleConfig = {
        maxCalls: 3,
        windowMs: 100,
        strategy: 'fixed',
      };

      const slidingConfig: ThrottleConfig = {
        maxCalls: 3,
        windowMs: 100,
        strategy: 'sliding',
      };

      // Fixed window: All 3 calls succeed
      for (let i = 0; i < 3; i++) {
        const result = checkThrottle('fixed-action', 'user1', fixedConfig);
        expect(result.allowed).toBe(true);
      }

      // Sliding window: All 3 calls succeed
      for (let i = 0; i < 3; i++) {
        const result = checkThrottle('sliding-action', 'user1', slidingConfig);
        expect(result.allowed).toBe(true);
      }

      // Wait for fixed window to reset (but not sliding)
      await new Promise((resolve) => setTimeout(resolve, 110));

      // Fixed window: Can immediately do 3 more calls
      for (let i = 0; i < 3; i++) {
        const result = checkThrottle('fixed-action', 'user1', fixedConfig);
        expect(result.allowed).toBe(true);
      }

      // Sliding window: Can also do 3 more calls (old ones expired)
      for (let i = 0; i < 3; i++) {
        const result = checkThrottle('sliding-action', 'user1', slidingConfig);
        expect(result.allowed).toBe(true);
      }
    });
  });
});
