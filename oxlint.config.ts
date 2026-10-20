import base from '@linzjs/style/oxlint.config';
import { defineConfig } from 'oxlint';

export default defineConfig({
  extends: [base],
  env: {
    node: true,
    es2023: true,
  },
});
