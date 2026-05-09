import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: [["text", { skipFull: false }], "html"],
      include: [
        "budget.js",
        "chart.js",
        "src/**/*.js"
      ],
      exclude: [
        "tests/**",
        "node_modules/**",
        "coverage/**"
      ]
    }
  }
});
