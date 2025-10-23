# Contributing to @arqetype/next-validated-action

Thank you for your interest in contributing to @arqetype/next-validated-action! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in your interactions.

### Our Standards

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Create a new branch for your feature or bugfix
4. Make your changes
5. Push to your fork
6. Submit a pull request

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/next-validated-action.git
cd next-validated-action

# Install dependencies
npm install

# Run tests to ensure everything is working
npm test
```

### Available Scripts

```bash
# Build the project
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Type check without emitting files
npm run lint
```

## Project Structure

```
next-validated-action/
├── src/
│   ├── __tests__/          # Test files
│   │   ├── builder.test.ts
│   │   ├── guards.test.ts
│   │   ├── utils.test.ts
│   │   └── validation.test.ts
│   ├── builder.ts          # ActionClientBuilder implementation
│   ├── guards.ts           # Type guard functions
│   ├── index.ts            # Public API exports
│   ├── types.ts            # TypeScript type definitions
│   ├── utils.ts            # Utility functions
│   └── validation.ts       # Validation logic
├── docs/                   # Documentation
│   ├── ADVANCED.md
│   └── API.md
├── examples/               # Example usage
├── dist/                   # Compiled output (generated)
├── jest.config.js          # Jest configuration
├── tsconfig.json           # TypeScript configuration
├── package.json
└── README.md
```

## Development Workflow

### Creating a Feature Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name
```

### Making Changes

1. **Write Tests First**: We follow Test-Driven Development (TDD) when possible
2. **Implement Feature**: Write the minimum code needed to make tests pass
3. **Update Documentation**: Update relevant documentation in `docs/` and `README.md`
4. **Add Examples**: If applicable, add usage examples in `examples/`

### Branch Naming Convention

- `feature/` - New features (e.g., `feature/add-timeout-support`)
- `fix/` - Bug fixes (e.g., `fix/validation-error-handling`)
- `docs/` - Documentation updates (e.g., `docs/update-api-reference`)
- `refactor/` - Code refactoring (e.g., `refactor/simplify-builder`)
- `test/` - Test additions or updates (e.g., `test/add-middleware-tests`)

## Testing

We use Jest for testing. All new features and bug fixes should include tests.

### Writing Tests

```typescript
import 'reflect-metadata';
import { action } from '../builder';
import { isSuccess } from '../guards';

describe('Feature Name', () => {
  it('should do something specific', async () => {
    // Arrange
    const testAction = action.action(async ({ parsedInput }) => {
      return { result: 'success' };
    });

    // Act
    const result = await testAction({ test: 'data' });

    // Assert
    expect(isSuccess(result)).toBe(true);
  });
});
```

### Test Guidelines

- **One assertion per test**: Keep tests focused
- **Use descriptive test names**: `it("should validate email format")` not `it("test email")`
- **Test edge cases**: Empty strings, null, undefined, large numbers, etc.
- **Test error conditions**: Not just happy paths
- **Mock external dependencies**: Don't make real API calls or database queries

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- validation.test.ts

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Coverage Requirements

- Aim for at least 80% code coverage
- All new features must have corresponding tests
- Bug fixes should include regression tests

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use explicit return types for public functions
- Avoid `any` type - use `unknown` when the type is truly unknown
- Use meaningful variable and function names

### Formatting

We follow standard TypeScript conventions:

```typescript
// Good
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

// Bad
export function formatError(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}
```

### Documentation

- Add JSDoc comments to all public functions and classes
- Include `@param`, `@returns`, and `@example` tags
- Keep comments up to date with code changes

Example:

````typescript
/**
 * Validates data against a DTO class using class-validator
 * @param dtoClass - The DTO class to validate against
 * @param data - The data to validate
 * @param errorPrefix - Prefix for error messages
 * @param options - Validation options to pass to class-validator
 * @returns Validation result with detailed error information
 * @example
 * ```ts
 * const result = await validateData(MyDto, { name: 'John' });
 * if (result.valid) {
 *   console.log(result.instance);
 * }
 * ```
 */
export async function validateData<T extends object>(
  dtoClass: new () => T,
  data: unknown,
  errorPrefix: string = 'Invalid data',
  options?: ValidatorOptions
): Promise<ValidateResponse<T>> {
  // Implementation
}
````

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect code meaning (formatting, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Changes to build process or auxiliary tools

### Examples

```bash
feat(builder): add timeout support for actions

Add configurable timeout option to ActionClientBuilder.
Actions that exceed the timeout will return a server error.

Closes #123

---

fix(validation): handle nested validation errors correctly

Previously, nested validation errors were not being captured
in the details array. This fix ensures all nested errors are
properly formatted and returned.

Fixes #456

---

docs(api): update middleware documentation

Add examples for common middleware patterns and clarify
execution order.
```

### Commit Best Practices

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Limit first line to 72 characters
- Reference issues and pull requests when relevant
- Explain "what" and "why", not "how"

## Pull Request Process

### Before Submitting

1. **Run all tests**: `npm test`
2. **Check types**: `npm run lint`
3. **Update documentation**: If you changed the API
4. **Add examples**: If applicable
5. **Update CHANGELOG**: Add your changes under "Unreleased"

### PR Title

Follow the same format as commit messages:

```
feat(builder): add timeout support
fix(validation): handle nested errors
docs(readme): update installation instructions
```

### PR Description

Include:

1. **What**: What changes did you make?
2. **Why**: Why did you make these changes?
3. **How**: How did you implement them?
4. **Testing**: How did you test your changes?
5. **Screenshots**: If UI-related
6. **Breaking Changes**: If any
7. **Related Issues**: Link to related issues

Template:

```markdown
## Description

Brief description of what this PR does.

## Motivation

Why is this change needed?

## Changes

- Change 1
- Change 2
- Change 3

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Breaking Changes

None / Describe breaking changes

## Related Issues

Closes #123
Relates to #456
```

### Review Process

1. At least one maintainer approval required
2. All CI checks must pass
3. No unresolved conversations
4. Up to date with main branch

### After Approval

We use squash merge to keep the main branch history clean. Your commits will be squashed into a single commit with the PR title.

## Reporting Issues

### Bug Reports

When reporting bugs, include:

- **Description**: Clear description of the bug
- **Reproduction**: Minimal code to reproduce the issue
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: Node version, OS, etc.
- **Stack Trace**: If applicable

Template:

````markdown
**Describe the bug**
A clear and concise description.

**To Reproduce**

```typescript
// Minimal reproduction code
```
````

**Expected behavior**
What you expected to happen.

**Actual behavior**
What actually happened.

**Environment:**

- Node version: 18.0.0
- Package version: 1.0.0
- OS: macOS 13.0

**Stack trace**

```
If applicable
```

```

### Feature Requests

When requesting features, include:

- **Problem**: What problem does this solve?
- **Solution**: Your proposed solution
- **Alternatives**: Alternative solutions considered
- **Additional Context**: Any other relevant information

## Questions?

Feel free to:

- Open an issue with the "question" label
- Start a discussion in GitHub Discussions
- Reach out to maintainers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:

- The project README
- Release notes
- GitHub contributors page

Thank you for contributing to @arqetype/next-validated-action! 🎉
```
