// @ts-check
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import comparatorPwa from "./scripts/comparator-pwa.mjs";
import { existsSync } from 'node:fs';
import { resolveBibleSource } from './src/lib/bible-source.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
// Pin the absolute path: Node may be started outside the repository directory.
const bibleSource = resolveBibleSource();

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
    define: { __LITERAE_BIBLE_SOURCE__: JSON.stringify(bibleSource) },
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
