// Stock Vite + TanStack Start config (no Lovable wrapper).
// Replicates what @lovable.dev/vite-tanstack-config provided when running
// locally: TanStack Start, React, Tailwind v4, tsconfig paths, "@" alias,
// VITE_* defines, React/TanStack dedupe, Nitro on build (Cloudflare default),
// dev server on port 8080.
// Dropped Lovable-only pieces: devtools injection, HMR gate, sandbox bridge,
// /__l5e asset proxy, and server error-logger overlays (console still works).
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command, mode }) => {
  // Capacitor Android bundle: static SPA output (the native WebView serves
  // files, no SSR server). Set via `bun run build:android` (vite
  // --mode android). The app uses no server functions/loaders, so SPA output
  // is lossless.
  const spaBuild = command === "build" && mode === "android";

  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), "VITE_"))) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }
  if (spaBuild) {
    // On-device bundle: prefer native services whenever the Capacitor bridge
    // is present (falls back to mocks if it isn't).
    envDefine["import.meta.env.VITE_CODEHER_NATIVE"] = JSON.stringify("1");
  }

  const config: UserConfig = {
    define: envDefine,
    ...(mode === "development"
      ? {
          environments: {
            client: { define: { "process.env.NODE_ENV": JSON.stringify("development") } },
          },
        }
      : {}),
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      // Pre-bundle only deps actually imported by src/routes + src/components/codeher
      // so first page load doesn't hang in "[optimizer] bundling dependencies...".
      // Heavy template deps (recharts, embla, day-picker, cmdk, vaul, input-otp)
      // live in src/components/ui/* but are never imported by the app — keep them
      // out of the optimizer.
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-router",
        "@tanstack/react-query",
        "lucide-react",
        "clsx",
        "tailwind-merge",
      ],
      exclude: [
        "recharts",
        "embla-carousel-react",
        "react-day-picker",
        "react-hook-form",
        "cmdk",
        "vaul",
        "input-otp",
      ],
      ignoreOutdatedRequests: true,
    },
    server: {
      host: "::",
      port: 8080,
      warmup: {
        clientFiles: ["./src/routes/index.tsx", "./src/components/codeher/*.tsx"],
      },
    },
    plugins: [
      tailwindcss(),
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
        server: { entry: "server" },
        // Android bundle: prerender the SPA shell to /index.html (the default
        // shell path "/_shell" yields no index.html for the WebView to boot).
        ...(spaBuild ? { spa: { enabled: true, prerender: { outputPath: "/index" } } } : {}),
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
      }),
      react(),
      // Build-only: matches the wrapper's local (non-sandbox) behavior.
      // Skipped for the SPA Android bundle (static files, no server).
      ...(command === "build" && !spaBuild ? [nitro({ defaultPreset: "cloudflare-module" })] : []),
    ],
  };

  return config;
});
