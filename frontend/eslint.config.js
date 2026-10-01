//  @ts-check

import { defineConfig } from "eslint/config";
import { tanstackConfig } from "@tanstack/eslint-config";
import reactPlugin from "eslint-plugin-react";
import reactRefresh from "eslint-plugin-react-refresh";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import tsParser from "@typescript-eslint/parser";
import js from "@eslint/js";
import globals from "globals";

export default defineConfig([
  ...tanstackConfig,
  reactHooks.configs.flat.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "no-unused-vars": "off", // disable for conflict
      "import/no-cycle": "off",
      "import/order": "off",
      "sort-imports": "off",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "after-used",
          ignoreRestSiblings: true,
          // Defines the regex pattern to ignore underscore-prefixed names
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-deprecated": "error",
      "pnpm/json-enforce-catalog": "off",
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      "react-refresh": reactRefresh,
      react: reactPlugin,
    },
    settings: {
      react: {
        version: "detect",
        pragma: "React",
        fragment: "Fragment",
      },
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "react/no-multi-comp": ["error", { ignoreStateless: true }],

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/config": "error",
      "react-hooks/error-boundaries": "error",
      "react-hooks/gating": "error",
      "react-hooks/globals": "error",
      "react-hooks/immutability": "error",
      "react-hooks/preserve-manual-memoization": "error",
      "react-hooks/purity": "error",
      "react-hooks/refs": "error",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/set-state-in-render": "error",
      "react-hooks/static-components": "error",
      "react-hooks/unsupported-syntax": "warn",
      "react-hooks/use-memo": "error",
      "react-hooks/incompatible-library": "warn",
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "react/react-in-jsx-scope": "off", // no need in React 17+
      "react/jsx-key": "error",

      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true, extraHOCs: ["createRootRoute", "createFileRoute"] },
      ],
    },
  },
  {
    ignores: [
      "vite-end.d.ts",
      "eslint.config.js",
      "prettier.config.js",
      "commitlint.config.js",
      "vitest.config.js",
      "vite.config.js",
      "tailwind.config.js",
      "postcss.config.js",
      "cypress.config.js",
      "src/routeTree.gen.ts",
      "src/components/ui/*.tsx",
    ],
  },
]);
