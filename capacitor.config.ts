import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.codeher.app",
  appName: "CodeHER",
  // Static SPA bundle from `bun run build:android` (TanStack Start SPA
  // prerender). Rebuild + `bunx cap sync` after web changes.
  webDir: "dist/client",
};

export default config;
