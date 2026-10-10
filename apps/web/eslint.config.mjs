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
    "public/kuromoji.js",
    // Vendored Kanji Stroke Animation Engine (synced unchanged from Kanji Animator New by scripts/sync-kanji-animator.mjs).
    "lib/kanji-animator/**",
  ]),
]);

export default eslintConfig;
