import 'reflect-metadata';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
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

class AddressDto {
  @IsString()
  @IsNotEmpty()
  street: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  zipCode: string;
}

class UserWithAddressDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
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

    it('should apply whitelist option', async () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        extraField: 'should be removed',
      };

      const result = await validateData(SimpleDto, data, 'Invalid', {
        whitelist: true,
      });

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.instance.name).toBe('John Doe');
        expect(result.instance.email).toBe('john@example.com');
        expect((result.instance as any).extraField).toBeUndefined();
      }
    });
  });

  describe('nested validation', () => {
    it('should validate nested objects successfully', async () => {
      const data = {
        name: 'John Doe',
        address: {
          street: '123 Main St',
          city: 'New York',
          zipCode: '10001',
        },
      };

      const result = await validateData(UserWithAddressDto, data);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.instance).toBeInstanceOf(UserWithAddressDto);
        expect(result.instance.name).toBe('John Doe');
        expect(result.instance.address.city).toBe('New York');
      }
    });

    it('should fail validation for invalid nested objects', async () => {
      const data = {
        name: 'John Doe',
        address: {
          street: '',
          city: '',
          zipCode: '',
        },
      };

      const result = await validateData(UserWithAddressDto, data);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.details.length).toBeGreaterThan(0);
        // Check for nested field errors
        expect(result.details.some((d) => d.field.includes('address'))).toBe(
          true
        );
      }
    });

    it('should report nested field names correctly', async () => {
      const data = {
        name: 'John Doe',
        address: {
          street: '',
          city: 'New York',
          zipCode: '10001',
        },
      };

      const result = await validateData(UserWithAddressDto, data);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        const streetError = result.details.find((d) =>
          d.field.includes('street')
        );
        expect(streetError).toBeDefined();
        expect(streetError?.field).toContain('address');
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

  it('should format nested field errors', () => {
    const details: ValidationError[] = [
      {
        field: 'address.street',
        constraints: ['should not be empty'],
      },
      {
        field: 'address.city',
        constraints: ['should not be empty'],
      },
    ];

    const message = formatValidationErrors(details);

    expect(message).toContain('2 field(s)');
    expect(message).toContain('address.street');
    expect(message).toContain('address.city');
  });

  it('should handle single constraint with nested field', () => {
    const details: ValidationError[] = [
      {
        field: 'user.profile.bio',
        constraints: ['must be longer than 10 characters'],
      },
    ];

    const message = formatValidationErrors(details);

    expect(message).toBe('user.profile.bio: must be longer than 10 characters');
  });
});
