// @ts-check
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import comparatorPwa from "./scripts/comparator-pwa.mjs";

// https://astro.build/config
export default defineConfig({
  integrations: [svelte(), comparatorPwa()],
  // Toutes les routes sont prérendues, sauf l’unique endpoint SQLite du comparateur.
  output: "static",
  adapter: node({ mode: "standalone" }),
  redirects: {
    "/comparateur": "/scriptorium/comparateur",
  },
  vite: {
    plugins: [tailwindcss()],
    // The dedicated worker must share the PWA scope to fetch WASM offline.
    worker: {
      rolldownOptions: { output: { entryFileNames: "scriptorium/bible-worker-[hash].js" } },
    },
    server: {
      watch: {
        ignored: [
          "**/data/**",
          "**/*.db",
          "**/*.db-wal",
          "**/*.db-shm",
          "**/*.db-journal",
        ],
      },
    },
  },
});
