import 'reflect-metadata';
import {
  validate,
  ValidatorOptions,
  ValidationError as ClassValidatorError,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import type { ValidateResponse, ValidationError } from './types';

/**
 * Validates data against a DTO class using class-validator
 * @param dtoClass - The DTO class to validate against
 * @param data - The data to validate
 * @param errorPrefix - Prefix for error messages
 * @param options - Validation options to pass to class-validator
 * @returns Validation result with detailed error information
 */
export async function validateData<T extends object>(
  dtoClass: new () => T,
  data: unknown,
  errorPrefix: string = 'Invalid data',
  options?: ValidatorOptions
): Promise<ValidateResponse<T>> {
  // Transform plain object to class instance
  const instance = plainToInstance(dtoClass, data);

  // Check if transformation succeeded
  if (!instance || typeof instance !== 'object') {
    return {
      valid: false,
      errors: [`${errorPrefix}: expected an object`],
      details: [],
    };
  }

  // Validate the instance
  const validationErrors = await validate(instance, options);

  // If validation failed, format errors
  if (validationErrors.length > 0) {
    const errors: string[] = [];
    const details: ValidationError[] = [];

    for (const error of validationErrors) {
      // Add string representation for backward compatibility
      errors.push(error.toString());

      // Add structured error details
      if (error.constraints) {
        details.push({
          field: error.property,
          constraints: Object.values(error.constraints),
        });
      }

      // Handle nested validation errors
      if (error.children && error.children.length > 0) {
        const processChildren = (
          children: ClassValidatorError[],
          prefix: string
        ) => {
          for (const child of children) {
            if (child.constraints) {
              details.push({
                field: `${prefix}.${child.property}`,
                constraints: Object.values(child.constraints),
              });
            }
            if (child.children && child.children.length > 0) {
              processChildren(child.children, `${prefix}.${child.property}`);
            }
          }
        };
        processChildren(error.children, error.property);
      }
    }

    return {
      valid: false,
      errors,
      details,
    };
  }

  return { valid: true, instance };
}

/**
 * Formats validation errors into a human-readable message
 * @param details - Array of validation errors
 * @returns Formatted error message
 */
export function formatValidationErrors(details: ValidationError[]): string {
  if (details.length === 0) {
    return 'Validation failed';
  }

  if (details.length === 1) {
    const detail = details[0];
    return `${detail.field}: ${detail.constraints.join(', ')}`;
  }

  return `Validation failed for ${details.length} field(s): ${details
    .map((d) => d.field)
    .join(', ')}`;
}
