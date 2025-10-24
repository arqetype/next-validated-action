'use server';

import { action } from '@arqetype/next-validated-action';
import { IsString, IsNotEmpty, IsEmail, MinLength } from 'class-validator';

// ============================================
// DTOs
// ============================================

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
  userId: string;

  @IsString()
  message: string;
}

// ============================================
// Mock Auth Helper
// ============================================

async function getCurrentAdmin() {
  // Simulate getting current admin user
  return { id: 'admin-123', email: 'admin@example.com', roles: ['admin'] };
}

// ============================================
// Example Action with Comprehensive Hooks
// ============================================

export const createUserAction = action
  .inputDto(CreateUserInput)
  .outputDto(CreateUserOutput)
  .needsAuth(getCurrentAdmin)
  .retry({ attempts: 3, delay: 1000, backoff: 'exponential' })
  .logger((level, message, meta) => {
    console.log(`[${level}] ${message}`, meta);
  })

  // ============================================
  // LIFECYCLE HOOKS
  // ============================================

  // Called before input validation
  .on('beforeValidation', async (ctx) => {
    console.log(`[${ctx.actionId}] 🚀 Starting validation...`);
    console.log('Raw input received:', ctx.rawInput);
  })

  // Called after successful input validation
  .on('afterValidation', async (ctx) => {
    console.log(`[${ctx.actionId}] ✅ Input validated successfully`);
    console.log('Validated data:', ctx.validatedInput);
  })

  // Called before the main handler executes
  .on('beforeExecution', async (ctx) => {
    console.log(`[${ctx.actionId}] ⚡ Executing action...`);
    console.time(`action-${ctx.actionId}`);
  })

  // Called after handler execution (before output validation)
  .on('afterExecution', async (ctx) => {
    console.timeEnd(`action-${ctx.actionId}`);
    console.log(`[${ctx.actionId}] 🎯 Handler completed`);
    console.log('Raw output:', ctx.rawOutput);
  })

  // ============================================
  // SUCCESS HOOK
  // ============================================

  .on('success', async (ctx) => {
    console.log(`[${ctx.actionId}] 🎉 Action successful!`);
    console.log(`Duration: ${ctx.duration}ms`);
    console.log('Result:', ctx.result.data);

    // Example: Analytics tracking (fire-and-forget)
    trackSuccess({
      actionId: ctx.actionId,
      userId: ctx.result.data.userId,
      duration: ctx.duration,
      timestamp: ctx.timestamp,
    });
  })

  // ============================================
  // ERROR HOOKS
  // ============================================

  // Generic error handler - catches ALL errors
  .on('error', async (ctx) => {
    console.error(`[${ctx.actionId}] ❌ Error occurred: ${ctx.errorType}`);
    console.error('Message:', ctx.message);

    // Example: Send to error tracking service (e.g., Sentry)
    reportError({
      actionId: ctx.actionId,
      errorType: ctx.errorType,
      message: ctx.message,
      error: ctx.error,
      timestamp: ctx.timestamp,
      user: ctx.user,
    });
  })

  // Specific: Authentication errors
  .on('authError', async (ctx) => {
    console.error(`[${ctx.actionId}] 🔒 Authentication failed`);
    console.error('Auth error:', ctx.message);

    // Example: Security monitoring
    logSecurityEvent({
      type: 'auth_failure',
      actionId: ctx.actionId,
      timestamp: ctx.timestamp,
      message: ctx.message,
    });
  })

  // Specific: Input validation errors
  .on('inputValidationError', async (ctx) => {
    console.error(`[${ctx.actionId}] 📝 Input validation failed`);
    console.error('Validation errors:', ctx.details);

    // Example: Track validation failures
    trackValidationError({
      actionId: ctx.actionId,
      fields: ctx.details.map((d) => d.field),
      errors: ctx.details,
      rawInput: ctx.rawInput,
    });
  })

  // Specific: Output validation errors (developer bug)
  .on('outputValidationError', async (ctx) => {
    console.error(`[${ctx.actionId}] 📤 Output validation failed - BUG!`);
    console.error('This indicates a bug in the action handler!');
    console.error('Details:', ctx.details);

    // Example: Alert developers
    alertDevelopers({
      severity: 'high',
      message: 'Output validation failed',
      actionId: ctx.actionId,
      details: ctx.details,
      rawOutput: ctx.rawOutput,
    });
  })

  // Specific: Server/handler errors
  .on('serverError', async (ctx) => {
    console.error(`[${ctx.actionId}] 💥 Server error occurred`);
    console.error('Error:', ctx.message);
    console.error('Cause:', ctx.cause);

    // Example: Detailed error tracking
    logServerError({
      actionId: ctx.actionId,
      message: ctx.message,
      cause: ctx.cause,
      timestamp: ctx.timestamp,
      user: ctx.user,
      input: ctx.parsedInput,
    });
  })

  // ============================================
  // RETRY HOOK
  // ============================================

  .on('retry', async (ctx) => {
    console.warn(
      `[${ctx.actionId}] 🔄 Retry attempt ${ctx.attempt}/${ctx.maxAttempts}`
    );
    console.warn(`Waiting ${ctx.delay}ms before retry...`);
    console.warn('Previous error:', ctx.error);

    // Example: Track retry metrics
    trackRetry({
      actionId: ctx.actionId,
      attempt: ctx.attempt,
      maxAttempts: ctx.maxAttempts,
      delay: ctx.delay,
    });
  })

  // ============================================
  // COMPLETION HOOK
  // ============================================

  // Always called at the end, regardless of success/failure
  .on('complete', async (ctx) => {
    console.log(`[${ctx.actionId}] 🏁 Action completed`);
    console.log(`Status: ${ctx.result.success ? 'SUCCESS' : 'FAILURE'}`);
    console.log(`Duration: ${ctx.duration}ms`);

    // Example: Always record metrics
    recordMetrics({
      actionId: ctx.actionId,
      duration: ctx.duration,
      success: ctx.result.success,
      errorType: ctx.result.success ? null : ctx.result.error,
      timestamp: ctx.timestamp,
    });

    // Example: Cleanup operations
    await cleanup(ctx.actionId);
  })

  // ============================================
  // ACTION HANDLER
  // ============================================

  .action(async ({ parsedInput, user }) => {
    // Simulate creating a user
    const userId = await createUser({
      name: parsedInput.name,
      email: parsedInput.email,
      password: parsedInput.password,
      createdBy: user?.id,
    });

    return {
      userId,
      message: 'User created successfully',
    };
  });

// ============================================
// Simpler Example - Real-World Use Case
// ============================================

class SubscribeInput {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

class SubscribeOutput {
  @IsString()
  message: string;
}

export const subscribeToNewsletterAction = action
  .inputDto(SubscribeInput)
  .outputDto(SubscribeOutput)

  // Track successful subscriptions
  .on('success', async (ctx) => {
    // Fire-and-forget analytics
    trackEvent('newsletter_subscribed', {
      email: ctx.parsedInput.email,
      timestamp: ctx.timestamp,
    });
  })

  // Send all errors to monitoring
  .on('error', (ctx) => {
    // Non-async, fire-and-forget
    reportError({
      action: 'subscribe',
      error: ctx.error,
      errorType: ctx.errorType,
    });
  })

  // Show friendly validation errors to users
  .on('inputValidationError', async (ctx) => {
    console.log('User input errors:', ctx.details);
    // Could send to UI notification system
  })

  .action(async ({ parsedInput }) => {
    await addToNewsletter(parsedInput.email, parsedInput.name);
    return { message: 'Successfully subscribed!' };
  });

// ============================================
// Mock Helper Functions
// ============================================

async function createUser(_data: {
  name: string;
  email: string;
  password: string;
  createdBy?: string;
}) {
  // Simulate user creation
  return 'user-' + Math.random().toString(36).substring(7);
}

async function addToNewsletter(email: string, name: string) {
  // Simulate newsletter subscription
  console.log(`Added ${name} (${email}) to newsletter`);
}

function trackSuccess(_data: unknown) {
  // Analytics tracking
}

function reportError(_data: unknown) {
  // Error tracking (e.g., Sentry)
}

function logSecurityEvent(_data: unknown) {
  // Security monitoring
}

function trackValidationError(_data: unknown) {
  // Form analytics
}

function alertDevelopers(_data: unknown) {
  // Developer alerts (Slack, email, etc.)
}

function logServerError(_data: unknown) {
  // Server error logging
}

function trackRetry(_data: unknown) {
  // Retry metrics
}

function recordMetrics(_data: unknown) {
  // General metrics recording
}

async function cleanup(_actionId: string) {
  // Cleanup operations
}

function trackEvent(_event: string, _data: unknown) {
  // Event tracking
}
