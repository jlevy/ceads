---
title: TypeScript Rules
description: TypeScript coding rules and best practices
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# TypeScript Rules

## Type Safety

- **Avoid `any`**: Use specific types or `unknown` when type is truly unknown
- **Use strict mode**: Enable `strict: true` in tsconfig.json
- **Define interfaces**: Create interfaces for complex objects and API responses
- **Use type guards**: Implement type guards for runtime type checking

## Async/Await

- **No floating promises**: Always await or handle promises
- **Use Promise.all**: For parallel async operations
- **Error handling**: Wrap async code in try/catch or use .catch()

## Functions

- **Return types**: Explicitly declare return types for public functions
- **Parameter types**: Always type function parameters
- **Default parameters**: Prefer default parameters over optional with fallback

## Null Safety

- **Strict null checks**: Handle null/undefined explicitly
- **Optional chaining**: Use `?.` for safe property access
- **Nullish coalescing**: Use `??` instead of `||` for defaults

## Imports/Exports

- **Named exports**: Prefer named exports over default exports
- **Import organization**: Group imports (node, external, internal)
- **No circular imports**: Avoid circular dependencies

## Error Handling

- **Custom errors**: Create typed error classes
- **Error messages**: Include actionable context in error messages
- **Never swallow errors**: Always log or rethrow

## Code Style

- **Const by default**: Use `const`, only use `let` when reassignment needed
- **Arrow functions**: Prefer arrow functions for callbacks
- **Destructuring**: Use for objects and arrays when it improves clarity
- **Template literals**: Use for string interpolation

## Comments

- **JSDoc for public APIs**: Document exported functions and types
- **Why not what**: Comments should explain reasoning, not describe code
- **TODO format**: `// TODO(username): description`
