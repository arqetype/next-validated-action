import 'reflect-metadata';
import { action } from '@arqetype/next-validated-action';
import { IsString, MinLength, IsEmail } from 'class-validator';

// ============================================================================
// Example 1: Search-as-you-type
// ============================================================================

class SearchInput {
  @IsString()
  @MinLength(2)
  query!: string;
}

export const searchAction = action
  .inputDto(SearchInput)
  .debounce(300) // Wait 300ms after user stops typing
  .action(async ({ parsedInput }) => {
    // Simulate API call
    console.log(`Searching for: ${parsedInput.query}`);
    const results = await fetch(
      `/api/search?q=${encodeURIComponent(parsedInput.query)}`
    );
    return await results.json();
  });

// Usage in a component:
// const handleSearch = (query: string) => {
//   searchAction({ query }); // Debounced automatically
// };

// ============================================================================
// Example 2: Autosave with maxWait
// ============================================================================

class FormData {
  @IsString()
  title!: string;

  @IsString()
  content!: string;
}

export const autosaveAction = action
  .inputDto(FormData)
  .debounceOptions({
    delay: 2000, // Wait 2s of inactivity
    maxWait: 10000, // But force save every 10s
  })
  .action(async ({ parsedInput }) => {
    console.log('Auto-saving...');
    await fetch('/api/save-draft', {
      method: 'POST',
      body: JSON.stringify(parsedInput),
    });
    return { saved: true, timestamp: new Date() };
  });

// ============================================================================
// Example 3: Email validation
// ============================================================================

class EmailInput {
  @IsEmail()
  email!: string;
}

export const validateEmailAction = action
  .inputDto(EmailInput)
  .debounce(500)
  .action(async ({ parsedInput }) => {
    console.log(`Checking if email exists: ${parsedInput.email}`);
    const response = await fetch(
      `/api/check-email?email=${encodeURIComponent(parsedInput.email)}`
    );
    const data = await response.json();
    return { available: !data.exists };
  });

// ============================================================================
// Example 4: Button click protection (leading edge)
// ============================================================================

class SubmitInput {
  @IsString()
  data!: string;
}

export const submitAction = action
  .inputDto(SubmitInput)
  .debounceOptions({
    delay: 1000,
    leading: true, // Execute immediately on first click
    trailing: false, // Ignore subsequent clicks
  })
  .action(async ({ parsedInput }) => {
    console.log('Submitting form...');
    return await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify(parsedInput),
    });
  });

// ============================================================================
// Example 5: Combined with other features
// ============================================================================

class AdvancedSearchInput {
  @IsString()
  @MinLength(3)
  query!: string;
}

export const advancedSearchAction = action
  .inputDto(AdvancedSearchInput)
  .needsAuth(async () => {
    // Your auth logic
    return { id: 1, name: 'John Doe' };
  })
  .debounce(300)
  .retry({ attempts: 3, delay: 1000 })
  .on('success', ({ result }) => {
    console.log('Search completed:', result);
  })
  .on('error', ({ message }) => {
    console.error('Search failed:', message);
  })
  .action(async ({ parsedInput, user }) => {
    console.log(`User ${user?.name} searching for: ${parsedInput.query}`);
    return await fetch(`/api/search?q=${parsedInput.query}`);
  });
