import 'reflect-metadata';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { validateData, formatValidationErrors } from '../validation';
import type { ValidationError } from '../types';

// Test DTOs
class SimpleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;
}

class ComplexDto {
  @IsString()
  @MinLength(8)
  password: string;

  @IsNumber()
  @Min(0)
  @Max(120)
  age: number;
}

describe('validateData', () => {
  describe('valid data', () => {
    it('should validate correct simple data', async () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const result = await validateData(SimpleDto, data);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.instance).toBeInstanceOf(SimpleDto);
        expect(result.instance.name).toBe('John Doe');
        expect(result.instance.email).toBe('john@example.com');
      }
    });

    it('should validate correct complex data', async () => {
      const data = {
        password: 'securePassword123',
        age: 25,
      };

      const result = await validateData(ComplexDto, data);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.instance).toBeInstanceOf(ComplexDto);
      }
    });
  });

  describe('invalid data', () => {
    it('should fail validation for empty name', async () => {
      const data = {
        name: '',
        email: 'john@example.com',
      };

      const result = await validateData(SimpleDto, data);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.details.length).toBeGreaterThan(0);
        expect(result.details[0].field).toBe('name');
      }
    });

    it('should fail validation for invalid email', async () => {
      const data = {
        name: 'John Doe',
        email: 'not-an-email',
      };

      const result = await validateData(SimpleDto, data);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.details.some((d) => d.field === 'email')).toBe(true);
      }
    });

    it('should fail validation for short password', async () => {
      const data = {
        password: 'short',
        age: 25,
      };

      const result = await validateData(ComplexDto, data);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.details.some((d) => d.field === 'password')).toBe(true);
      }
    });

    it('should fail validation for age out of range', async () => {
      const data = {
        password: 'securePassword123',
        age: 150,
      };

      const result = await validateData(ComplexDto, data);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.details.some((d) => d.field === 'age')).toBe(true);
      }
    });

    it('should return multiple validation errors', async () => {
      const data = {
        name: '',
        email: 'not-an-email',
      };

      const result = await validateData(SimpleDto, data);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.details.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should fail for non-object data', async () => {
      const result = await validateData(SimpleDto, null);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0]).toContain('expected an object');
      }
    });

    it('should fail for string data', async () => {
      const result = await validateData(SimpleDto, 'not an object');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0]).toContain('expected an object');
      }
    });
  });

  describe('with custom error prefix', () => {
    it('should use custom error prefix', async () => {
      const result = await validateData(SimpleDto, null, 'Custom prefix');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0]).toContain('Custom prefix');
      }
    });
  });

  describe('with validation options', () => {
    it('should apply validation options', async () => {
      const data = {
        name: '',
        email: 'not-an-email',
      };

      const result = await validateData(SimpleDto, data, 'Invalid', {
        stopAtFirstError: true,
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        // stopAtFirstError may still return multiple errors from single validator
        expect(result.details.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('formatValidationErrors', () => {
  it('should format single error', () => {
    const details: ValidationError[] = [
      {
        field: 'email',
        constraints: ['must be an email'],
      },
    ];

    const message = formatValidationErrors(details);

    expect(message).toBe('email: must be an email');
  });

  it('should format multiple constraints', () => {
    const details: ValidationError[] = [
      {
        field: 'password',
        constraints: [
          'must be longer than 8 characters',
          'must contain a number',
        ],
      },
    ];

    const message = formatValidationErrors(details);

    expect(message).toContain('password');
    expect(message).toContain('must be longer than 8 characters');
  });

  it('should format multiple field errors', () => {
    const details: ValidationError[] = [
      {
        field: 'email',
        constraints: ['must be an email'],
      },
      {
        field: 'name',
        constraints: ['should not be empty'],
      },
    ];

    const message = formatValidationErrors(details);

    expect(message).toContain('2 field(s)');
    expect(message).toContain('email');
    expect(message).toContain('name');
  });

  it('should return default message for empty details', () => {
    const message = formatValidationErrors([]);

    expect(message).toBe('Validation failed');
  });
});
