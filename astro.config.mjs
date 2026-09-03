// @ts-check
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  integrations: [svelte()],
  // Toutes les routes sont prérendues, sauf l’unique endpoint SQLite du comparateur.
  output: "static",
  adapter: node({ mode: "standalone" }),
  redirects: {
    "/comparateur": "/scriptorium/comparateur",
  },
  vite: {
    plugins: [tailwindcss()],
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
