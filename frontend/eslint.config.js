//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config";
import reactRefresh from "eslint-plugin-react-refresh";

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...tanstackConfig,
  {
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      "import/no-cycle": "off",
      "import/order": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
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
    ],
  },
];
