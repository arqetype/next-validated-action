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
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { action } from '../builder';
import {
  isSuccess,
  isError,
  isInputError,
  isServerError,
  isAuthError,
  unwrap,
  unwrapOr,
} from '../guards';

// Real-world DTOs
class LoginInput {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

class LoginOutput {
  @IsString()
  token: string;

  @IsString()
  userId: string;
}

class UpdateProfileInput {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsNumber()
  @Min(0)
  @Max(150)
  age: number;
}

class UpdateProfileOutput {
  @IsString()
  id: string;

  @IsString()
  message: string;
}

class ShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  street: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  zipCode: string;
}

class CreateOrderInput {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;
}

class CreateOrderOutput {
  @IsString()
  orderId: string;

  @IsNumber()
  totalAmount: number;

  @IsString()
  status: string;
}

// Mock user type
interface User {
  id: string;
  email: string;
  role: string;
}

describe('Integration Tests - Real World Scenarios', () => {
  describe('Authentication Flow', () => {
    it('should handle complete login flow', async () => {
      const loginAction = action
        .inputDto(LoginInput)
        .outputDto(LoginOutput)
        .action(async ({ parsedInput }) => {
          // Simulate authentication
          if (parsedInput.email === 'test@example.com') {
            return {
              token: 'mock-jwt-token',
              userId: 'user-123',
            };
          }
          throw new Error('Invalid credentials');
        });

      const result = await loginAction({
        email: 'test@example.com',
        password: 'securePassword123',
      });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.token).toBe('mock-jwt-token');
        expect(result.data.userId).toBe('user-123');
      }
    });

    it('should reject invalid login credentials', async () => {
      const loginAction = action
        .inputDto(LoginInput)
        .outputDto(LoginOutput)
        .action(async ({ parsedInput }) => {
          if (parsedInput.email !== 'test@example.com') {
            throw new Error('Invalid credentials');
          }
          return {
            token: 'token',
            userId: 'user-id',
          };
        });

      const result = await loginAction({
        email: 'wrong@example.com',
        password: 'password123',
      });

      expect(isServerError(result)).toBe(true);
    });

    it('should validate email format in login', async () => {
      const loginAction = action
        .inputDto(LoginInput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return { token: 'token', userId: 'id' };
        });

      const result = await loginAction({
        email: 'not-an-email',
        password: 'password123',
      });

      expect(isInputError(result)).toBe(true);
    });
  });

  describe('Protected Actions with Authentication', () => {
    const mockAuthHandler = async (): Promise<User | null> => {
      return {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
      };
    };

    it('should handle authenticated profile update', async () => {
      const updateProfileAction = action
        .needsAuth(mockAuthHandler)
        .inputDto(UpdateProfileInput)
        .outputDto(UpdateProfileOutput)
        .action(async ({ parsedInput, user }) => {
          return {
            id: user!.id,
            message: `Profile updated for ${parsedInput.name}`,
          };
        });

      const result = await updateProfileAction({
        name: 'John Doe',
        bio: 'Software Engineer',
        age: 30,
      });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.id).toBe('user-123');
        expect(result.data.message).toContain('John Doe');
      }
    });

    it('should reject unauthenticated profile updates', async () => {
      const updateProfileAction = action
        .needsAuth(async () => null)
        .inputDto(UpdateProfileInput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return { id: 'id', message: 'Updated' };
        });

      const result = await updateProfileAction({
        name: 'John Doe',
        age: 30,
      });

      expect(isAuthError(result)).toBe(true);
    });
  });

  describe('Complex Validation with Nested Objects', () => {
    it('should handle order creation with nested address', async () => {
      const createOrderAction = action
        .inputDto(CreateOrderInput)
        .outputDto(CreateOrderOutput)
        .action(async ({ parsedInput }) => {
          return {
            orderId: `order-${Date.now()}`,
            totalAmount: parsedInput.quantity * 99.99,
            status: 'pending',
          };
        });

      const result = await createOrderAction({
        productId: 'prod-123',
        quantity: 2,
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
        },
      });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.orderId).toContain('order-');
        expect(result.data.totalAmount).toBe(199.98);
        expect(result.data.status).toBe('pending');
      }
    });

    it('should fail for invalid nested address', async () => {
      const createOrderAction = action
        .inputDto(CreateOrderInput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return { orderId: 'id', totalAmount: 100, status: 'pending' };
        });

      const result = await createOrderAction({
        productId: 'prod-123',
        quantity: 2,
        shippingAddress: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
        },
      });

      expect(isInputError(result)).toBe(true);
      if (isInputError(result)) {
        expect(result.details?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Middleware for Logging and Monitoring', () => {
    it('should log request and response times', async () => {
      const logs: Array<{ type: string; time: number }> = [];

      const timedAction = action
        .use(async (_ctx, next) => {
          const startTime = Date.now();
          logs.push({ type: 'start', time: startTime });
          const result = await next();
          const endTime = Date.now();
          logs.push({ type: 'end', time: endTime });
          return result;
        })
        .action(async ({ parsedInput: _parsedInput }) => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { success: true };
        });

      await timedAction({});

      expect(logs.length).toBe(2);
      expect(logs[0].type).toBe('start');
      expect(logs[1].type).toBe('end');
      expect(logs[1].time - logs[0].time).toBeGreaterThanOrEqual(50);
    });

    it('should implement rate limiting middleware', async () => {
      const calls: number[] = [];

      const rateLimitedAction = action
        .use(async (ctx, next) => {
          calls.push(Date.now());
          if (calls.length > 3) {
            return {
              success: false,
              error: 'server',
              message: 'Rate limit exceeded',
            } as any;
          }
          return await next();
        })
        .action(async ({ parsedInput: _parsedInput }) => {
          return { success: true };
        });

      // Make 5 calls
      for (let i = 0; i < 5; i++) {
        await rateLimitedAction({});
      }

      expect(calls.length).toBe(5);
      // Fourth and fifth calls should hit rate limit
      const result4 = await rateLimitedAction({});
      expect(isServerError(result4)).toBe(true);
    });
  });

  describe('Retry Logic for Unstable APIs', () => {
    it('should retry and succeed on unstable API', async () => {
      let attempts = 0;

      const unstableAction = action
        .retry({ attempts: 3, delay: 50 })
        .action(async ({ parsedInput: _parsedInput }) => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Service temporarily unavailable');
          }
          return { success: true, attempts };
        });

      const result = await unstableAction({});

      expect(isSuccess(result)).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should not retry validation errors', async () => {
      let attempts = 0;

      const validatedAction = action
        .inputDto(LoginInput)
        .retry({ attempts: 3, delay: 10 })
        .action(async ({ parsedInput: _parsedInput }) => {
          attempts++;
          return { token: 'token', userId: 'id' };
        });

      const result = await validatedAction({
        email: 'invalid-email',
        password: 'pass',
      });

      expect(isInputError(result)).toBe(true);
      expect(attempts).toBe(0); // Should not reach handler
    });
  });

  describe('Result Handling Patterns', () => {
    it('should use unwrap for expected success', async () => {
      const successAction = action.action(
        async ({ parsedInput: _parsedInput }) => {
          return { message: 'Success' };
        }
      );

      const result = await successAction({});
      const data = unwrap(result);

      expect((data as any).message).toBe('Success');
    });

    it('should throw on unwrap for errors', async () => {
      const failAction = action.action(
        async ({ parsedInput: _parsedInput }) => {
          throw new Error('Failed');
        }
      );

      const result = await failAction({});

      expect(() => unwrap(result)).toThrow('Failed');
    });

    it('should use unwrapOr for default values', async () => {
      const maybeFailAction = action.action(
        async ({ parsedInput: _parsedInput }) => {
          throw new Error('Failed');
        }
      );

      const result = await maybeFailAction({});
      const data = unwrapOr(result, { message: 'Default' });

      expect((data as any).message).toBe('Default');
    });
  });

  describe('Action Composition Patterns', () => {
    const mockAdminUser: User = {
      id: 'admin-123',
      email: 'admin@example.com',
      role: 'admin',
    };

    const mockRegularUser: User = {
      id: 'user-123',
      email: 'user@example.com',
      role: 'user',
    };

    it('should compose authenticated action base', async () => {
      const authenticatedAction = action
        .needsAuth(async () => mockRegularUser)
        .logger((level, message) => {
          // Silent logger for tests
        });

      const myAction = authenticatedAction
        .inputDto(UpdateProfileInput)
        .action(async ({ parsedInput, user }) => {
          return {
            id: user!.id,
            message: `Updated ${parsedInput.name}`,
          };
        });

      const result = await myAction({
        name: 'Test User',
        age: 25,
      });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect((result.data as any).id).toBe('user-123');
        expect((result.data as any).message).toContain('Test User');
      }
    });

    it('should enforce role-based access in composed actions', async () => {
      const requireAdmin = async (): Promise<User | null> => {
        const user = mockRegularUser;
        if (user.role !== 'admin') {
          throw new Error('Admin access required');
        }
        return user;
      };

      const adminAction = action.needsAuth(requireAdmin);

      const deleteUserAction = adminAction.action(
        async ({ parsedInput: _parsedInput }) => {
          return { success: true };
        }
      );

      const result = await deleteUserAction({});

      expect(isAuthError(result)).toBe(true);
    });

    it('should allow admin actions when user has admin role', async () => {
      const requireAdmin = async (): Promise<User | null> => {
        const user = mockAdminUser;
        if (user.role !== 'admin') {
          throw new Error('Admin access required');
        }
        return user;
      };

      const adminAction = action.needsAuth(requireAdmin);

      const deleteUserAction = adminAction.action(
        async ({ parsedInput: _parsedInput, user }) => {
          return { deletedBy: user!.id, success: true };
        }
      );

      const result = await deleteUserAction({});

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect((result.data as any).deletedBy).toBe('admin-123');
      }
    });
  });

  describe('Validation Options and Whitelist', () => {
    it('should strip extra fields with whitelist option', async () => {
      let receivedInput: any = null;

      const strictAction = action
        .inputDto(UpdateProfileInput)
        .validationOptions({ whitelist: true })
        .action(async ({ parsedInput }) => {
          receivedInput = parsedInput;
          return { success: true };
        });

      const result = await strictAction({
        name: 'John',
        age: 30,
        extraField: 'should be removed',
        anotherExtra: 'also removed',
      });

      expect(isSuccess(result)).toBe(true);
      expect(receivedInput).not.toBeNull();
      expect(receivedInput.name).toBe('John');
      expect(receivedInput.age).toBe(30);
      expect(receivedInput.extraField).toBeUndefined();
      expect(receivedInput.anotherExtra).toBeUndefined();
    });

    it('should forbid non-whitelisted fields when configured', async () => {
      const strictAction = action
        .inputDto(UpdateProfileInput)
        .validationOptions({ whitelist: true, forbidNonWhitelisted: true })
        .action(async ({ parsedInput: _parsedInput }) => {
          return { success: true };
        });

      const result = await strictAction({
        name: 'John',
        age: 30,
        hackerField: 'malicious',
      });

      expect(isInputError(result)).toBe(true);
    });
  });

  describe('Error Message Formatting', () => {
    it('should provide detailed validation error messages', async () => {
      const validateAction = action
        .inputDto(CreateOrderInput)
        .action(async ({ parsedInput: _parsedInput }) => {
          return { orderId: 'id', totalAmount: 100, status: 'pending' };
        });

      const result = await validateAction({
        productId: '',
        quantity: -1,
        shippingAddress: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
        },
      });

      expect(isInputError(result)).toBe(true);
      if (isInputError(result)) {
        expect(result.message).toBeTruthy();
        expect(result.details).toBeDefined();
        expect(result.details!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Concurrent Actions', () => {
    it('should handle multiple concurrent action calls', async () => {
      let callCount = 0;

      const concurrentAction = action.action(
        async ({ parsedInput: _parsedInput }) => {
          callCount++;
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { callNumber: callCount };
        }
      );

      const results = await Promise.all([
        concurrentAction({ id: 1 }),
        concurrentAction({ id: 2 }),
        concurrentAction({ id: 3 }),
      ]);

      expect(results.length).toBe(3);
      results.forEach((result) => {
        expect(isSuccess(result)).toBe(true);
      });
      expect(callCount).toBe(3);
    });
  });
});
