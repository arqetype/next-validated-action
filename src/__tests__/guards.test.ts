import 'reflect-metadata';
import type { ActionResult } from '../types';
import {
  isSuccess,
  isError,
  isInputError,
  isServerError,
  isOutputError,
  isAuthError,
  unwrap,
  unwrapOr,
} from '../guards';

describe('Type Guards', () => {
  describe('isSuccess', () => {
    it('should return true for success result', () => {
      const result: ActionResult<{ message: string }> = {
        success: true,
        data: { message: 'Success' },
      };

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        // Type narrowing test - this should compile
        expect(result.data.message).toBe('Success');
      }
    });

    it('should return false for error result', () => {
      const result: ActionResult<any> = {
        success: false,
        error: 'input',
        message: 'Invalid input',
      };

      expect(isSuccess(result)).toBe(false);
    });
  });

  describe('isError', () => {
    it('should return true for error result', () => {
      const result: ActionResult<any> = {
        success: false,
        error: 'server',
        message: 'Server error',
      };

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        // Type narrowing test
        expect(result.message).toBe('Server error');
      }
    });

    it('should return false for success result', () => {
      const result: ActionResult<{ data: string }> = {
        success: true,
        data: { data: 'test' },
      };

      expect(isError(result)).toBe(false);
    });
  });

  describe('isInputError', () => {
    it('should return true for input error', () => {
      const result: ActionResult<any> = {
        success: false,
        error: 'input',
        message: 'Invalid input',
        details: [{ field: 'email', constraints: ['must be an email'] }],
      };

      expect(isInputError(result)).toBe(true);
      if (isInputError(result)) {
        expect(result.error).toBe('input');
        expect(result.details).toBeDefined();
      }
    });

    it('should return false for other error types', () => {
      const serverError: ActionResult<any> = {
        success: false,
        error: 'server',
        message: 'Server error',
      };

      const authError: ActionResult<any> = {
        success: false,
        error: 'auth',
        message: 'Auth error',
      };

      expect(isInputError(serverError)).toBe(false);
      expect(isInputError(authError)).toBe(false);
    });

    it('should return false for success result', () => {
      const result: ActionResult<any> = {
        success: true,
        data: {},
      };

      expect(isInputError(result)).toBe(false);
    });
  });

  describe('isServerError', () => {
    it('should return true for server error', () => {
      const result: ActionResult<any> = {
        success: false,
        error: 'server',
        message: 'Internal server error',
        cause: new Error('Database connection failed'),
      };

      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) {
        expect(result.error).toBe('server');
        expect(result.cause).toBeDefined();
      }
    });

    it('should return false for other error types', () => {
      const inputError: ActionResult<any> = {
        success: false,
        error: 'input',
        message: 'Input error',
      };

      expect(isServerError(inputError)).toBe(false);
    });
  });

  describe('isOutputError', () => {
    it('should return true for output error', () => {
      const result: ActionResult<any> = {
        success: false,
        error: 'output',
        message: 'Invalid output',
        details: [{ field: 'userId', constraints: ['must be a string'] }],
      };

      expect(isOutputError(result)).toBe(true);
      if (isOutputError(result)) {
        expect(result.error).toBe('output');
        expect(result.details).toBeDefined();
      }
    });

    it('should return false for other error types', () => {
      const serverError: ActionResult<any> = {
        success: false,
        error: 'server',
        message: 'Server error',
      };

      expect(isOutputError(serverError)).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('should return true for auth error', () => {
      const result: ActionResult<any> = {
        success: false,
        error: 'auth',
        message: 'Authentication required',
      };

      expect(isAuthError(result)).toBe(true);
      if (isAuthError(result)) {
        expect(result.error).toBe('auth');
        expect(result.message).toBe('Authentication required');
      }
    });

    it('should return false for other error types', () => {
      const inputError: ActionResult<any> = {
        success: false,
        error: 'input',
        message: 'Input error',
      };

      expect(isAuthError(inputError)).toBe(false);
    });
  });

  describe('unwrap', () => {
    it('should return data for success result', () => {
      const result: ActionResult<{ message: string }> = {
        success: true,
        data: { message: 'Success' },
      };

      const data = unwrap(result);

      expect(data).toEqual({ message: 'Success' });
    });

    it('should throw error for error result', () => {
      const result: ActionResult<any> = {
        success: false,
        error: 'server',
        message: 'Server error',
      };

      expect(() => unwrap(result)).toThrow('Server error');
    });

    it('should throw error for input validation failure', () => {
      const result: ActionResult<any> = {
        success: false,
        error: 'input',
        message: 'Invalid email',
      };

      expect(() => unwrap(result)).toThrow('Invalid email');
    });

    it('should throw error for auth failure', () => {
      const result: ActionResult<any> = {
        success: false,
        error: 'auth',
        message: 'Authentication required',
      };

      expect(() => unwrap(result)).toThrow('Authentication required');
    });
  });

  describe('unwrapOr', () => {
    it('should return data for success result', () => {
      const result: ActionResult<{ message: string }> = {
        success: true,
        data: { message: 'Success' },
      };

      const data = unwrapOr(result, { message: 'Default' });

      expect(data).toEqual({ message: 'Success' });
    });

    it('should return default value for error result', () => {
      const result: ActionResult<{ message: string }> = {
        success: false,
        error: 'server',
        message: 'Server error',
      };

      const data = unwrapOr(result, { message: 'Default' });

      expect(data).toEqual({ message: 'Default' });
    });

    it('should return default value for input error', () => {
      const result: ActionResult<number> = {
        success: false,
        error: 'input',
        message: 'Invalid input',
      };

      const data = unwrapOr(result, 0);

      expect(data).toBe(0);
    });

    it('should return default value for auth error', () => {
      const result: ActionResult<string[]> = {
        success: false,
        error: 'auth',
        message: 'Not authenticated',
      };

      const data = unwrapOr(result, []);

      expect(data).toEqual([]);
    });
  });
});
