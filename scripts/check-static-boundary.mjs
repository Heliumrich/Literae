import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "src");
const ALLOWED_DYNAMIC_ROUTE = "src/pages/api/bible/verses.ts";
const ALLOWED_ISLAND = "src/pages/scriptorium/comparateur.astro";

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(target) : [target];
    }),
  );
  return files.flat();
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

const sourceFiles = await walk(SOURCE);
const textFiles = sourceFiles.filter((file) => /\.(astro|svelte|ts|js)$/.test(file));
const contents = await Promise.all(
  textFiles.map(async (file) => ({ file: relative(file), source: await readFile(file, "utf8") })),
);

const errors = [];
const dynamicRoutes = contents
  .filter(({ source }) => /export\s+const\s+prerender\s*=\s*false/.test(source))
  .map(({ file }) => file);

if (dynamicRoutes.length !== 1 || dynamicRoutes[0] !== ALLOWED_DYNAMIC_ROUTE) {
  errors.push(
    `Routes dynamiques attendues: ${ALLOWED_DYNAMIC_ROUTE}; trouvées: ${dynamicRoutes.join(", ") || "aucune"}`,
  );
}

const islands = contents.flatMap(({ file, source }) =>
  [...source.matchAll(/client:(?:load|idle|visible|media|only)/g)].map(() => file),
);

if (islands.length !== 1 || islands[0] !== ALLOWED_ISLAND) {
  errors.push(
    `Îlot hydraté attendu: ${ALLOWED_ISLAND}; trouvés: ${islands.join(", ") || "aucun"}`,
  );
}

const comparatorPage = contents.find(({ file }) => file === ALLOWED_ISLAND)?.source || "";
if (!/<Comparator\b[^>]*client:only=["']svelte["']/.test(comparatorPage)) {
  errors.push("Le comparateur doit rester l’unique îlot Svelte avec client:only=\"svelte\".");
}

for (const { file, source } of contents.filter(({ file }) => file.endsWith(".json.ts"))) {
  if (!/export\s+const\s+prerender\s*=\s*true/.test(source)) {
    errors.push(`${file} doit déclarer prerender = true.`);
  }
}

const astroConfig = await readFile(path.join(ROOT, "astro.config.mjs"), "utf8");
if (!/output:\s*["']static["']/.test(astroConfig)) {
  errors.push('astro.config.mjs doit conserver output: "static".');
}

if (errors.length) {
  console.error("Frontière statique invalide:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Frontière statique vérifiée:");
console.log(`- 1 îlot Svelte: ${ALLOWED_ISLAND}`);
console.log(`- 1 route serveur: ${ALLOWED_DYNAMIC_ROUTE}`);
console.log("- catalogues JSON prérendus au build");
