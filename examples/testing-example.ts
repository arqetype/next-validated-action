import 'reflect-metadata';
import { IsString, IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { action } from '@arqetype/next-validated-action';
import {
  createMockAction,
  createTestContext,
  createMockAuthHandler,
  createSuccessResult,
  createAuthErrorResult,
  createInputErrorResult,
  createServerErrorResult,
  createValidationError,
  createHookSpy,
  MockActionBuilder,
  waitFor,
  wait,
} from '@arqetype/next-validated-action/testing';
import {
  isSuccess,
  isAuthError,
  isInputError,
} from '@arqetype/next-validated-action';

// ============================================================================
// Example DTOs
// ============================================================================

class CreateUserInput {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

class CreateUserOutput {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;
}

class User {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

// ============================================================================
// Example Actions (to be tested)
// ============================================================================

const createUserAction = action
  .inputDto(CreateUserInput)
  .outputDto(CreateUserOutput)
  .needsAuth<User>(async () => {
    // In real app, this would check session/JWT
    return { id: '123', email: 'admin@example.com', role: 'admin' };
  })
  .action(async ({ parsedInput }) => {
    // Simulate database operation
    return {
      id: Math.random().toString(36).substring(7),
      name: parsedInput.name,
      email: parsedInput.email,
    };
  });

// ============================================================================
// Example 1: Basic Mock Action
// ============================================================================

async function example1_basicMock() {
  console.log('\n=== Example 1: Basic Mock Action ===\n');

  // Create a mock action that returns success
  const mockAction = createMockAction(createUserAction)
    .mockSuccess({
      id: 'mock-123',
      name: 'Test User',
      email: 'test@example.com',
    })
    .build();

  const result = await mockAction({
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
  });

  if (isSuccess(result)) {
    console.log('✓ User created:', result.data);
  }
}

// ============================================================================
// Example 2: Mock Validation Errors
// ============================================================================

async function example2_validationErrors() {
  console.log('\n=== Example 2: Mock Validation Errors ===\n');

  const mockAction = createMockAction()
    .mockInputValidationError([
      createValidationError('email', 'must be a valid email'),
      createValidationError('password', 'must be at least 8 characters'),
    ])
    .build();

  const result = await mockAction({
    email: 'invalid-email',
    password: 'short',
  });

  if (isInputError(result)) {
    console.log('✗ Validation failed:', result.message);
    console.log('  Details:', result.details);
  }
}

// ============================================================================
// Example 3: Mock Authentication Errors
// ============================================================================

async function example3_authErrors() {
  console.log('\n=== Example 3: Mock Authentication Errors ===\n');

  const mockAction = createMockAction()
    .mockAuthError('User session expired')
    .build();

  const result = await mockAction({ test: 'data' });

  if (isAuthError(result)) {
    console.log('✗ Authentication failed:', result.message);
  }
}

// ============================================================================
// Example 4: Mock with User Context
// ============================================================================

async function example4_userContext() {
  console.log('\n=== Example 4: Mock with User Context ===\n');

  const adminUser: User = {
    id: 'admin-123',
    email: 'admin@example.com',
    role: 'admin',
  };

  const mockAction = createMockAction()
    .mockUser(adminUser)
    .mockSuccess({ result: 'Admin action completed' })
    .build();

  const result = await mockAction({ action: 'delete' });

  if (isSuccess(result)) {
    console.log('✓ Admin action completed:', result.data);
  }
}

// ============================================================================
// Example 5: Custom Implementation
// ============================================================================

async function example5_customImplementation() {
  console.log('\n=== Example 5: Custom Implementation ===\n');

  let callCount = 0;

  const mockAction = new MockActionBuilder<
    { value: number },
    { doubled: number },
    unknown
  >()
    .mockImplementation(async (input, _context) => {
      callCount++;

      // Simulate flaky service that fails first 2 times
      if (callCount <= 2) {
        return createServerErrorResult('Service temporarily unavailable');
      }

      return createSuccessResult({ doubled: input.value * 2 });
    })
    .build();

  // First attempt - fails
  const result1 = await mockAction({ value: 5 });
  console.log('Attempt 1:', isSuccess(result1) ? 'Success' : 'Failed');

  // Second attempt - fails
  const result2 = await mockAction({ value: 5 });
  console.log('Attempt 2:', isSuccess(result2) ? 'Success' : 'Failed');

  // Third attempt - succeeds
  const result3 = await mockAction({ value: 5 });
  console.log('Attempt 3:', isSuccess(result3) ? 'Success' : 'Failed');

  if (isSuccess(result3)) {
    console.log('✓ Final result:', result3.data);
  }
}

// ============================================================================
// Example 6: Tracking Call History
// ============================================================================

async function example6_callHistory() {
  console.log('\n=== Example 6: Tracking Call History ===\n');

  const builder = new MockActionBuilder<
    { name: string },
    { id: string; name: string },
    unknown
  >().mockSuccess({ id: '123', name: 'User' });

  const mockAction = builder.build();

  // Make multiple calls
  await mockAction({ name: 'Alice' });
  await mockAction({ name: 'Bob' });
  await mockAction({ name: 'Charlie' });

  console.log('Total calls:', builder.getCallCount());
  console.log(
    'Was called with Alice:',
    builder.wasCalledWith({ name: 'Alice' })
  );
  console.log('First call:', builder.getFirstCall()?.input);
  console.log('Last call:', builder.getLastCall()?.input);

  const history = builder.getCallHistory();
  console.log('\nFull history:');
  history.forEach((call, i) => {
    console.log(
      `  ${i + 1}. ${call.input.name} at ${call.timestamp.toISOString()}`
    );
  });
}

// ============================================================================
// Example 7: Hook Spies
// ============================================================================

async function example7_hookSpies() {
  console.log('\n=== Example 7: Hook Spies ===\n');

  const beforeValidationSpy = createHookSpy();
  const successSpy = createHookSpy();
  const completeSpy = createHookSpy();

  const mockAction = createMockAction()
    .mockSuccess({ result: 'ok' })
    .withHooks({
      beforeValidation: [beforeValidationSpy.callback],
      success: [successSpy.callback],
      complete: [completeSpy.callback],
    })
    .build();

  await mockAction({ test: 'data' });

  console.log('beforeValidation called:', beforeValidationSpy.wasCalled());
  console.log('success called:', successSpy.wasCalled());
  console.log('complete called:', completeSpy.wasCalled());
  console.log(
    'Total hooks fired:',
    beforeValidationSpy.getCallCount() +
      successSpy.getCallCount() +
      completeSpy.getCallCount()
  );
}

// ============================================================================
// Example 8: Testing with Delays
// ============================================================================

async function example8_delays() {
  console.log('\n=== Example 8: Testing with Delays ===\n');

  const mockAction = createMockAction()
    .mockSuccess({ result: 'ok' })
    .withDelay(100) // Simulate network latency
    .build();

  console.log('Starting request...');
  const startTime = Date.now();

  const result = await mockAction({ test: 'data' });

  const duration = Date.now() - startTime;
  console.log(`✓ Request completed in ${duration}ms`);

  if (isSuccess(result)) {
    console.log('Result:', result.data);
  }
}

// ============================================================================
// Example 9: Wait Utilities
// ============================================================================

async function example9_waitUtilities() {
  console.log('\n=== Example 9: Wait Utilities ===\n');

  let processing = true;

  // Simulate async operation
  setTimeout(() => {
    processing = false;
  }, 200);

  console.log('Waiting for processing to complete...');

  await waitFor(() => !processing, { timeout: 1000, interval: 50 });

  console.log('✓ Processing completed!');

  // Simple wait
  console.log('Waiting 100ms...');
  await wait(100);
  console.log('✓ Done waiting!');
}

// ============================================================================
// Example 10: Test Context Creation
// ============================================================================

async function example10_testContext() {
  console.log('\n=== Example 10: Test Context Creation ===\n');

  const input = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'securepass123',
  };

  const user: User = {
    id: '123',
    email: 'john@example.com',
    role: 'user',
  };

  const context = createTestContext(input, user);

  console.log('Test context created:');
  console.log('  Input:', context.parsedInput);
  console.log('  User:', context.user);

  // Use in handler testing
  const handler = async ({ parsedInput, user }: typeof context) => {
    return {
      message: `Hello ${parsedInput.name}, your role is ${user?.role}`,
    };
  };

  const result = await handler(context);
  console.log('✓ Handler result:', result);
}

// ============================================================================
// Example 11: Mock Auth Handler
// ============================================================================

async function example11_mockAuthHandler() {
  console.log('\n=== Example 11: Mock Auth Handler ===\n');

  // Mock authenticated user
  const authenticatedHandler = createMockAuthHandler({
    id: '123',
    email: 'user@example.com',
    role: 'user' as const,
  });

  const authenticatedUser = await authenticatedHandler();
  console.log('Authenticated user:', authenticatedUser);

  // Mock unauthenticated user
  const unauthenticatedHandler = createMockAuthHandler(null);
  const unauthenticatedUser = await unauthenticatedHandler();
  console.log('Unauthenticated user:', unauthenticatedUser);
}

// ============================================================================
// Example 12: Result Creators for Assertions
// ============================================================================

async function example12_resultCreators() {
  console.log('\n=== Example 12: Result Creators ===\n');

  // Create various result types for testing
  const successResult = createSuccessResult({ id: '123', name: 'Test' });
  console.log('Success result:', successResult);

  const authError = createAuthErrorResult('Invalid credentials');
  console.log('Auth error:', authError);

  const inputError = createInputErrorResult([
    createValidationError('email', 'invalid format'),
  ]);
  console.log('Input error:', inputError);

  const serverError = createServerErrorResult(
    'Database connection failed',
    new Error('Connection timeout')
  );
  console.log('Server error:', serverError);
}

// ============================================================================
// Example 13: Integration Test Pattern
// ============================================================================

async function example13_integrationTest() {
  console.log('\n=== Example 13: Integration Test Pattern ===\n');

  // This pattern shows how you might test a real action
  // by mocking its dependencies while keeping the actual logic

  const mockCreateUser = async (input: CreateUserInput) => {
    // Simulate validation
    if (!input.email.includes('@')) {
      return createInputErrorResult([
        createValidationError('email', 'must be a valid email'),
      ]);
    }

    if (input.password.length < 8) {
      return createInputErrorResult([
        createValidationError('password', 'must be at least 8 characters'),
      ]);
    }

    // Simulate success
    return createSuccessResult({
      id: 'user-' + Math.random().toString(36).substring(7),
      name: input.name,
      email: input.email,
    });
  };

  // Test valid input
  const validResult = await mockCreateUser({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'securepass123',
  });

  if (isSuccess(validResult)) {
    console.log('✓ User created successfully:', validResult.data);
  }

  // Test invalid email
  const invalidEmailResult = await mockCreateUser({
    name: 'Jane Doe',
    email: 'invalid-email',
    password: 'securepass123',
  });

  if (isInputError(invalidEmailResult)) {
    console.log('✗ Invalid email rejected:', invalidEmailResult.message);
  }

  // Test short password
  const shortPasswordResult = await mockCreateUser({
    name: 'Bob Smith',
    email: 'bob@example.com',
    password: 'short',
  });

  if (isInputError(shortPasswordResult)) {
    console.log('✗ Short password rejected:', shortPasswordResult.message);
  }
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Next Validated Action - Testing Utilities Examples    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await example1_basicMock();
  await example2_validationErrors();
  await example3_authErrors();
  await example4_userContext();
  await example5_customImplementation();
  await example6_callHistory();
  await example7_hookSpies();
  await example8_delays();
  await example9_waitUtilities();
  await example10_testContext();
  await example11_mockAuthHandler();
  await example12_resultCreators();
  await example13_integrationTest();

  console.log(
    '\n╔════════════════════════════════════════════════════════════╗'
  );
  console.log('║                    All Examples Complete!                  ║');
  console.log(
    '╚════════════════════════════════════════════════════════════╝\n'
  );
}

// Run if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

export {
  example1_basicMock,
  example2_validationErrors,
  example3_authErrors,
  example4_userContext,
  example5_customImplementation,
  example6_callHistory,
  example7_hookSpies,
  example8_delays,
  example9_waitUtilities,
  example10_testContext,
  example11_mockAuthHandler,
  example12_resultCreators,
  example13_integrationTest,
};
