import { loadConfigFromFile } from "vite";
import { defineConfig, mergeConfig } from "vitest/config";

export default defineConfig(async (configEnv) => {
  const loadedConfig = await loadConfigFromFile(configEnv, "vite.config.ts");
  if (!loadedConfig) throw new Error("Unable to load the application Vite config.");

  return mergeConfig(
    loadedConfig.config,
    defineConfig({
      test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
      },
    }),
  );
});
