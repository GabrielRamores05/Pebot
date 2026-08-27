import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
