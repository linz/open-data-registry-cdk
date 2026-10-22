// choose one
// import base from "@linzjs/style/oxlint.config";
import base from "@linzjs/style/oxlint.config-react";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [base],
  env: {
    browser: true,
    es2023: true,
    // "node": true
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.stories.*"],
      plugins: ["vitest"],
      jsPlugins: [
        // requires npm install
        // 'eslint-plugin-testing-library',
        // 'eslint-plugin-storybook',
      ],
    },
  ],
});
