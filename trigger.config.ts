import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID ?? "flowforge",
  runtime: "node",
  logLevel: "log",
  dirs: ["./trigger"],
  maxDuration: 60, // generous headroom for downloading + cropping large images
  build: {
    // sharp ships native bindings — mark it external so Trigger.dev's
    // bundler doesn't try to inline it (crop-image task depends on it via
    // lib/image-processing.ts).
    external: ["sharp"],
  },
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
});
