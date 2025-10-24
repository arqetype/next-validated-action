/**
 * Throttle Examples
 *
 * This file demonstrates how to use the throttle feature to limit
 * the execution frequency of server actions.
 */

import { IsString, IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { action } from '../src';

// ============================================================================
// Example 1: Basic Global Throttling
// ============================================================================

class SendMessageInput {
  @IsString()
  @IsNotEmpty()
  message!: string;
}

/**
 * Throttle to 5 messages per minute globally
 * All users share the same throttle limit
 */
export const sendMessage = action
  .inputDto(SendMessageInput)
  .throttle({
    maxCalls: 5,
    windowMs: 60000, // 1 minute
    strategy: 'fixed',
  })
  .action(async ({ parsedInput }) => {
    console.log(`Sending message: ${parsedInput.message}`);
    // Send message logic here
    return { sent: true, messageId: Math.random().toString(36) };
  });

// ============================================================================
// Example 2: Per-User Throttling
// ============================================================================

class CreatePostInput {
  @IsString()
  @MinLength(10)
  title!: string;

  @IsString()
  @MinLength(50)
  content!: string;
}

/**
 * Throttle to 3 posts per hour per user
 * Each user has their own separate throttle limit
 */
export const createPost = action
  .inputDto(CreatePostInput)
  .needsAuth(async () => {
    // Your auth logic here - returning mock user
    return { id: 'user-123', email: 'user@example.com' };
  })
  .throttle({
    maxCalls: 3,
    windowMs: 3600000, // 1 hour
    strategy: 'sliding',
    identifier: (ctx) => ctx.user?.id || 'anonymous',
  })
  .action(async ({ parsedInput, user }) => {
    console.log(`Creating post "${parsedInput.title}" for user ${user?.id}`);
    // Create post logic here
    return {
      postId: Math.random().toString(36),
      title: parsedInput.title,
      author: user?.email,
    };
  });

// ============================================================================
// Example 3: API Rate Limiting
// ============================================================================

class CallExternalAPIInput {
  @IsString()
  endpoint!: string;
}

/**
 * Throttle external API calls to prevent hitting rate limits
 * Uses sliding window for more granular control
 */
export const callExternalAPI = action
  .inputDto(CallExternalAPIInput)
  .throttle({
    maxCalls: 100,
    windowMs: 60000, // 100 calls per minute
    strategy: 'sliding',
  })
  .action(async ({ parsedInput }) => {
    console.log(`Calling external API: ${parsedInput.endpoint}`);
    // External API call logic here
    const response = await fetch(
      `https://api.example.com/${parsedInput.endpoint}`
    );
    return await response.json();
  });

// ============================================================================
// Example 4: Email Sending with Throttle
// ============================================================================

class SendEmailInput {
  @IsEmail()
  to!: string;

  @IsString()
  subject!: string;

  @IsString()
  body!: string;
}

/**
 * Throttle email sending to prevent spam
 * 10 emails per 5 minutes per recipient
 */
export const sendEmail = action
  .inputDto(SendEmailInput)
  .throttle({
    maxCalls: 10,
    windowMs: 300000, // 5 minutes
    strategy: 'sliding',
    identifier: (ctx) => ctx.parsedInput?.to || 'unknown',
  })
  .action(async ({ parsedInput }) => {
    console.log(`Sending email to ${parsedInput.to}: ${parsedInput.subject}`);
    // Email sending logic here
    return {
      sent: true,
      messageId: `msg-${Date.now()}`,
    };
  });

// ============================================================================
// Example 5: Fixed Window Strategy
// ============================================================================

class SubmitFormInput {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;
}

/**
 * Fixed window strategy resets the counter at fixed intervals
 * Simpler and more memory-efficient than sliding window
 */
export const submitForm = action
  .inputDto(SubmitFormInput)
  .throttle({
    maxCalls: 5,
    windowMs: 60000, // 5 submissions per minute
    strategy: 'fixed', // Resets every minute on the dot
  })
  .action(async ({ parsedInput }) => {
    console.log(`Processing form submission from ${parsedInput.email}`);
    // Form processing logic here
    return { success: true, submissionId: Date.now() };
  });

// ============================================================================
// Example 6: Sliding Window Strategy
// ============================================================================

class SearchInput {
  @IsString()
  @MinLength(2)
  query!: string;
}

/**
 * Sliding window strategy tracks individual call timestamps
 * More accurate but uses slightly more memory
 */
export const search = action
  .inputDto(SearchInput)
  .throttle({
    maxCalls: 20,
    windowMs: 10000, // 20 searches per 10 seconds
    strategy: 'sliding', // Rolling window
  })
  .action(async ({ parsedInput }) => {
    console.log(`Searching for: ${parsedInput.query}`);
    // Search logic here
    return {
      results: [{ id: 1, title: `Result for ${parsedInput.query}` }],
      total: 1,
    };
  });

// ============================================================================
// Example 7: Combining Throttle with Other Features
// ============================================================================

class ProcessDataInput {
  @IsString()
  data!: string;
}

/**
 * Throttle combined with retry, cache, and authentication
 * Shows how throttle integrates with the full feature set
 */
export const processData = action
  .inputDto(ProcessDataInput)
  .needsAuth(async () => {
    return { id: 'user-456', role: 'admin' };
  })
  .throttle({
    maxCalls: 10,
    windowMs: 60000,
    strategy: 'sliding',
    identifier: (ctx) => ctx.user?.id || 'anonymous',
  })
  .cache({
    ttl: 30000, // Cache for 30 seconds
  })
  .retry({
    attempts: 3,
    delay: 1000,
    backoff: 'exponential',
  })
  .action(async ({ parsedInput, user }) => {
    console.log(`Processing data for user ${user?.id}`);
    // Data processing logic here
    return {
      processed: true,
      data: parsedInput.data.toUpperCase(),
    };
  });

// ============================================================================
// Example 8: Custom Identifier Based on IP (requires middleware)
// ============================================================================

class VoteInput {
  @IsString()
  itemId!: string;
}

/**
 * Throttle based on IP address
 * Note: IP would need to be provided via middleware in a real app
 */
export const vote = action
  .inputDto(VoteInput)
  .use(async (ctx, next) => {
    // In a real app, you'd extract IP from request headers
    // For demo purposes, we'll add it to the context
    (ctx as any).ip = '192.168.1.1';
    return await next();
  })
  .throttle({
    maxCalls: 3,
    windowMs: 3600000, // 3 votes per hour
    strategy: 'fixed',
    identifier: (ctx) => (ctx as any).ip || 'unknown',
  })
  .action(async ({ parsedInput }) => {
    console.log(`Vote recorded for item: ${parsedInput.itemId}`);
    return { voted: true, itemId: parsedInput.itemId };
  });

// ============================================================================
// Example 9: Very Strict Throttling
// ============================================================================

class ResetPasswordInput {
  @IsEmail()
  email!: string;
}

/**
 * Very strict throttle for sensitive operations
 * Only 2 password resets per hour per email
 */
export const resetPassword = action
  .inputDto(ResetPasswordInput)
  .throttle({
    maxCalls: 2,
    windowMs: 3600000, // 1 hour
    strategy: 'sliding',
    identifier: (ctx) => ctx.parsedInput?.email || 'unknown',
  })
  .action(async ({ parsedInput }) => {
    console.log(`Sending password reset email to ${parsedInput.email}`);
    // Password reset logic here
    return {
      sent: true,
      message: 'Password reset email sent',
    };
  });

// ============================================================================
// Example 10: High-Frequency Throttling
// ============================================================================

class AnalyticsEventInput {
  @IsString()
  eventName!: string;

  @IsString()
  data!: string;
}

/**
 * High-frequency operations with generous limits
 * 1000 analytics events per minute
 */
export const trackAnalytics = action
  .inputDto(AnalyticsEventInput)
  .throttle({
    maxCalls: 1000,
    windowMs: 60000,
    strategy: 'sliding',
  })
  .action(async ({ parsedInput }) => {
    console.log(`Tracking event: ${parsedInput.eventName}`);
    // Analytics tracking logic here
    return { tracked: true };
  });

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example usage in a Next.js server action or API route:
 *
 * // In your component or API:
 * const result = await sendMessage({ message: 'Hello!' });
 *
 * if (!result.success) {
 *   if (result.message.includes('Too many requests')) {
 *     console.error('Rate limit exceeded');
 *     // Show user-friendly error message
 *   }
 * }
 *
 * // With per-user throttling:
 * const postResult = await createPost({
 *   title: 'My Post Title',
 *   content: 'This is the content of my post...'
 * });
 *
 * // Error handling for throttled requests:
 * if (!postResult.success && postResult.error === 'server') {
 *   if (postResult.message.includes('Too many requests')) {
 *     const retryMatch = postResult.message.match(/Try again in (\d+)s/);
 *     if (retryMatch) {
 *       const retryAfter = parseInt(retryMatch[1]);
 *       console.log(`Please wait ${retryAfter} seconds before trying again`);
 *     }
 *   }
 * }
 */
