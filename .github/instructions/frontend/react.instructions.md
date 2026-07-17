---
name: 'React Standards'
description: 'Coding conventions for React files'
applyTo: '**/*.jsx, **/*.tsx'
---

# Coding Conventions

- Use function components instead of class components.
- Use hooks for managing state and side effects.
- Export only one component per component file.
- Type props should be declared explicitly with TypeScript interfaces.
- Use `React.FC` only when necessary; prefer explicit function types for components.
- Keep component files small and focused; ideally, one component per file.
- Use prop destructuring for better readability and maintainability.
- Avoid using inline styles; prefer TailwindCSS.
- Local states and refs should have types.
- Prefer function declarations over arrow functions for component definitions.
- Adhere to TypeScript and TailwindCSS instructions throughout the project.

# State

- Use `useState` for simple state management.
- Use `useReducer` for complex state logic.
- Keep state as minimal as possible; derive state when necessary.
- Avoid deeply nested state; normalize state structure if needed.
- Use `useCallback` and `useMemo` to optimize performance when dealing with state updates.
- Use `zustand` for global state management such as API data.
- Consider using `React Context` for lightweight and UI global state needs.

# Effects

- Use `useEffect` for side effects such as data fetching and subscriptions.
- Keep the dependency array accurate to avoid unnecessary re-renders.
- Clean up effects properly to prevent memory leaks.
- Prefer `useLayoutEffect` only when necessary for DOM measurements.
- Use dependency arrays carefully to ensure effects run only when necessary.

# File Structure

- Use `components` directory for reusable React components.
- Use `layouts` directory for layout components that structure pages.
- Use `pages` directory for top-level page components.
- Use `hooks` directory for custom React hooks.
- Use `utils` directory for utility functions and helpers.
- Use `styles` directory for TailwindCSS configuration and custom styles.
- Use `assets` directory for static assets such as images, fonts, and icons.
- Use `api` directory for API-related code such as service functions and API clients.
- Use `contexts` directory for React context providers and related code.
- Use `tests` directory for test files related to components, hooks, and other parts of the application.
- Use `mocks` directory for mock data and mock implementations used in tests.
- Use `config` directory for configuration files and environment-specific settings.

# Naming Conventions

- Use PascalCase for component names.
- Use kebab-case for file names.
- Use camelCase for variable and function names.
- Use UPPER_SNAKE_CASE for constants.
- Functions that perform specific actions should have verb-based names.
- Functions, variables or states that represent boolean values should start with a prefix as in yes/no questions, such as `is`, `has`, `can`, or `should`.
- Custom hooks should start with the `use` prefix.
- Event handler functions should start with the `handle` prefix.
- Test files should have the same name as the file they are testing, with a `.test` suffix.
- Context providers should be named with a `Provider` suffix.
- Custom hooks that wrap context consumption should start with the `use` prefix and match the context name.
- Files containing context providers should be named after the context they provide, with a `-context` suffix.

# Component Structure

- Components should have 500 lines of code at max.
- Components should have depth of 5 levels at max.
- Components should be divided into smaller subcomponents if they exceed these limits.
- Main components should be name in a folder with the same name as the component.
- Component folders should include an `index.tsx` file as the main entry point for the component.
- Subcomponents should be placed in the same folder as the main component and named according to their purpose.
- Component folders should include a `README.md` file to document the component's purpose, usage, and any relevant details.
