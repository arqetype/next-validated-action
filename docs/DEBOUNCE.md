# Debounce

Debouncing delays action execution until a specified time has passed since the last invocation. This is useful for search-as-you-type, autosave, and other frequently triggered actions.

## Basic Usage

```typescript
import { action } from '@arqetype/next-validated-action';
import { IsString } from 'class-validator';

class SearchInput {
  @IsString()
  query!: string;
}

const searchAction = action
  .inputDto(SearchInput)
  .debounce(300) // Wait 300ms after last call
  .action(async ({ parsedInput }) => {
    const results = await searchDatabase(parsedInput.query);
    return { results };
  });
```

## Advanced Options

```typescript
const searchAction = action
  .inputDto(SearchInput)
  .debounceOptions({
    delay: 300, // Delay in milliseconds (required)
    leading: false, // Execute on first call (default: false)
    trailing: true, // Execute after delay (default: true)
    maxWait: 1000, // Maximum wait time before forcing execution
  })
  .action(async ({ parsedInput }) => {
    return await search(parsedInput.query);
  });
```

## Common Use Cases

### Search-as-you-type

```typescript
// Only search after user stops typing for 300ms
const searchAction = action
  .inputDto(SearchInput)
  .debounce(300)
  .action(async ({ parsedInput }) => {
    return await fetch(`/api/search?q=${parsedInput.query}`);
  });
```

### Autosave with maxWait

```typescript
// Save after 2s of inactivity, but force save every 10s
const autosaveAction = action
  .inputDto(FormData)
  .needsAuth(getCurrentUser)
  .debounceOptions({
    delay: 2000,
    maxWait: 10000,
  })
  .action(async ({ parsedInput, user }) => {
    await saveFormDraft(user.id, parsedInput);
    return { saved: true };
  });
```

### Button click protection

```typescript
// Execute immediately, ignore subsequent clicks for 1s
const submitAction = action
  .inputDto(FormInput)
  .debounceOptions({
    delay: 1000,
    leading: true,
    trailing: false,
  })
  .action(async ({ parsedInput }) => {
    return await submitForm(parsedInput);
  });
```

## Important Notes

- **Validation timing**: Input validation happens after the debounce delay
- **Shared state**: Multiple calls to the same action share debounce state
- **Error handling**: All pending promises receive the same result or error
- **Works with all features**: Combine with auth, middleware, retry, hooks, etc.

## API Reference

### `debounce(delay: number)`

Simple debounce with trailing edge execution.

### `debounceOptions(config: DebounceConfig)`

Advanced configuration with `delay`, `leading`, `trailing`, and `maxWait` options.
