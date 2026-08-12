import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests share one real Postgres database and reset it between cases,
    // so test files must not run concurrently against it.
    fileParallelism: false,
  },
});
