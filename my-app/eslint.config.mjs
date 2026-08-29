import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Pre-existing technical debt: many files use `any` for Prisma query results
  // and API response data. Proper typing requires schema-level type mapping —
  // tracked as tech debt. See `.specify/memory/constitution.md` §VI for the
  // long-term goal of zero `any`.
  {
    files: ['next.config.*'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Pre-existing React hook patterns (setState in effects, Date.now in render)
  // are established patterns across the codebase. Fixing them requires re-architecting
  // component effects — tracked as tech debt.
  {
    files: ['**/*.tsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // CommonJS Node scripts
    "server.js",
    "electron/**",
    "scripts/**",
    // Generated Prisma client, committed for the packaged Electron build
    "lib/prisma-client/**",
  ]),
]);

export default eslintConfig;
