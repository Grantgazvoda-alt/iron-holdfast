import { defineConfig } from "vitest/config";

/** Node-only tests for repository/static-file behavior that should not run in workerd. */
export default defineConfig({
  test: {
    environment: "node",
  },
});
