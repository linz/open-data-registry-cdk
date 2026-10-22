import base from "@linzjs/style/oxfmt.config";
import { defineConfig } from "oxfmt";

export default defineConfig({
  extends: [base],
  // single quote is most common override
  singleQuote: false,
});
