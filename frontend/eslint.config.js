//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config";
import reactPlugin from "eslint-plugin-react";
import reactRefresh from "eslint-plugin-react-refresh";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...tanstackConfig,
  reactHooks.configs.flat.recommended,
  {
    plugins: {
      "react-refresh": reactRefresh,
      react: reactPlugin,
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
      "import/no-cycle": "off",
      "import/order": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
      "react/no-multi-comp": ["error", { ignoreStateless: true }],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true, extraHOCs: ["createRootRoute", "createFileRoute"] },
      ],
    },
  },
  {
    ignores: [
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
];
