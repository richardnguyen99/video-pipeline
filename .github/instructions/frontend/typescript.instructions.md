---
name: 'TypeScript Standards'
description: 'Coding conventions for TypeScript files'
applyTo: '**/*.ts, **/*.tsx'
---

# Coding Conventions

- Use 2 spaces for indentation.
- Use semicolons at the end of statements.
- Use double quotes for strings.
- Use string interpolation (template literals) for constructing strings with variables and avoid string concatenation.
- Always use explicit types for function parameters and return values.
- Prefer `interface` over `type` for defining object shapes.
- Use `readonly` for properties that should not be modified.
- Avoid using `any`; use more specific types whenever possible.
- Use `unknown` instead of `any` when the type is not known.
- Use type assertions sparingly and only when necessary.
- Use utility types like `Partial`, `Required`, `Pick`, and `Omit` to manipulate types effectively.
- Prefer `const` over `let` and `var` for variable declarations.
- Use `enum` for a set of related constants instead of union types of string literals.
- Prefer async/await over Promises for asynchronous code.
- Use `try/catch` blocks for error handling in asynchronous code.

# Modules and Imports

- Use ES6 module syntax (`import` and `export`) instead of CommonJS (`require` and `module.exports`).
- Keep import statements organized: external libraries first, followed by internal modules.
- Use absolute imports for internal modules when possible, and avoid relative paths that traverse multiple directories.
- Group and order imports logically, separating different types of imports with a blank line.
- Avoid importing entire modules when only specific exports are needed; use named imports instead.
- Use `index.ts` files to simplify import paths within directories.

# Naming Conventions

- Use `PascalCase` for class names, interfaces, and types.
- Use `camelCase` for variable names, function names, and object properties.
- Use `UPPER_SNAKE_CASE` for constants that are meant to be immutable and globally accessible.
- Prefix private fields with an underscore (`_`).
- Private and helper functions should be prefixed with an underscore (`_`).
- Prefer function declarations over arrow functions for defining named functions.
- Prefer asynchronous function calls for I/O-bound operations.
- Use `async`/`await` consistently for asynchronous functions to improve readability and maintainability.
- Avoid mixing `async`/`await` with `.then()` and `.catch()` for handling Promises.
- Prefer using `Promise.all` for running multiple asynchronous operations concurrently when they are independent of each other.

# Error Handling

- Always handle errors gracefully and provide meaningful error messages.
- Avoid swallowing errors silently; always log or propagate them appropriately.
- Prefer using `try/catch` blocks around code that may throw exceptions.
- For asynchronous code, ensure that all Promises are either awaited or properly handled with `.catch()`.
- Avoid using `try/catch` for control flow; it should only be used for handling exceptional cases.
- Always clean up resources (e.g., closing file handles, network connections) in a `finally` block when necessary.
