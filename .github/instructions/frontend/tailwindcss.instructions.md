---
name: 'Tailwind CSS Standards'
description: 'Coding conventions for Tailwind CSS'
applyTo: '**/*.css, **/*.tsx'
---

# Coding conventions

- Use direct TailwindCSS classes in HTML and JSX/TSX components.
- Write complex TailwindCSS classes in CSS files when multiple selectors and rules are involved.
- Avoid using inline styles; prefer TailwindCSS classes for styling.
- Use responsive utility classes to handle different screen sizes effectively.
- Leverage TailwindCSS's built-in variants (e.g., `hover:`, `focus:`, `active:`) for state-based styling.
- Use the `@apply` directive in CSS files to compose utility classes when necessary for better maintainability.
- Use the `@layer` directive to define custom layers for organizing your TailwindCSS styles.
- Use the `@utilities` directive to define custom utility classes in your TailwindCSS setup.
- Use the `@theme` directive to access and customize your TailwindCSS theme values.
- Prefer TailwindCSS functions.
