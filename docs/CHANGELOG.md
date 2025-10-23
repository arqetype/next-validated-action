# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release with core functionality
- Type-safe server actions with TypeScript generics
- Input validation using class-validator
- Output validation using class-validator
- Authentication support with custom auth handlers
- Middleware system for intercepting action execution
- Retry logic with configurable backoff strategies (linear/exponential)
- Built-in logging and observability support
- **Lifecycle hooks system** - 12 hook events for observability and telemetry:
  - Lifecycle hooks: `beforeValidation`, `afterValidation`, `beforeExecution`, `afterExecution`
  - Success hook: `success`
  - Error hooks: `error`, `authError`, `inputValidationError`, `outputValidationError`, `serverError`
  - Retry hook: `retry`
  - Completion hook: `complete`
  - Multiple hooks of the same type supported
  - Async and sync callback support
  - Type-safe context objects for each hook
  - Non-breaking error handling (hook errors won't fail actions)
- Rate limit metadata configuration
- Custom validation options support
- Type guard utilities (isSuccess, isError, isInputError, etc.)
- Unwrap utilities (unwrap, unwrapOr)
- Comprehensive error handling with structured error types
- Detailed validation error reporting
- Support for nested object validation
- Action composition patterns
- Fluent builder API
- Complete test coverage with Jest (196 tests including 37 hooks tests)
- Comprehensive documentation (API Reference, Advanced Usage Guide, Hooks Guide)
- Example usage files
- Contributing guidelines

### Features

- **Validation**: Detailed validation errors with field-level constraints
- **Authentication**: Flexible auth handlers with type-safe user context
- **Middleware**: Onion-model middleware execution with context access
- **Retry**: Automatic retry with exponential/linear backoff
- **Logging**: Structured logging with multiple log levels (info, debug, warn, error)
- **Type Safety**: Full TypeScript support with discriminated unions
- **Error Handling**: Four error types (input, output, server, auth) with detailed information
- **Developer Experience**: Method chaining, IntelliSense support, helpful error messages

## [1.0.0] - 2024-01-XX

### Added

- Initial stable release
- Production-ready API
- Complete documentation
- Full test coverage

---

### Release Notes Format

#### Added

For new features.

#### Changed

For changes in existing functionality.

#### Deprecated

For soon-to-be removed features.

#### Removed

For now removed features.

#### Fixed

For any bug fixes.

#### Security

In case of vulnerabilities.

---

## Migration Guides

### From 0.x to 1.0

No migration needed - this is the initial stable release.

---

## Links

- [Documentation](./docs)
- [Contributing](./CONTRIBUTING.md)
- [License](./LICENSE)
