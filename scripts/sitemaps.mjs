import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(file));
    else if (entry.name.endsWith('.html')) files.push(file);
  }
  return files;
}

/** Generate the existing /sitemap.xml URL from the actual canonical HTML pages. */
export default function sitemaps({ mainOrigin, artOrigin }) {
  const main = new URL(mainOrigin).origin;
  const art = new URL(artOrigin).origin;
  let client;
  return {
    name: 'literae-sitemaps',
    hooks: {
      'astro:config:done': ({ config }) => { client = fileURLToPath(config.build.client); },
      'astro:build:done': async ({ logger }) => {
        const sites = new Map([[main, { filename: 'sitemap.xml', urls: new Set() }]]);
        if (art !== main) sites.set(art, { filename: 'sitemap-art.xml', urls: new Set() });

        for (const file of await htmlFiles(client)) {
          const html = await readFile(file, 'utf8');
          const excluded = [...html.matchAll(/<meta\b[^>]*>/gi)].some(([tag]) =>
            /\bhttp-equiv=["']refresh["']/i.test(tag)
            || (/\bname=["']robots["']/i.test(tag) && /\bcontent=["'][^"']*\bnoindex\b/i.test(tag)));
          if (excluded) continue;
          const link = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0];
          const canonical = link?.match(/\bhref=["']([^"']+)["']/i)?.[1];
          // Only absolute canonicals; JSON, API and Bible files are not HTML.
          if (!canonical || !URL.canParse(canonical)) continue;
          sites.get(new URL(canonical).origin)?.urls.add(canonical);
        }

        const declarations = [];
        for (const [origin, { filename, urls }] of sites) {
          if (!urls.size) throw new Error(`Aucune page canonique pour ${origin} ; sitemap non généré.`);
          // BaseLayout already escapes these attribute values as XML-compatible HTML.
          const entries = [...urls].sort().map(url => `  <url><loc>${url}</loc></url>`).join('\n');
          await writeFile(path.join(client, filename), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`);
          declarations.push(`Sitemap: ${new URL(filename, origin + '/').href}`);
          logger.info(`${filename} : ${urls.size} URL canoniques.`);
        }
        await writeFile(path.join(client, 'robots.txt'), `User-agent: *\nAllow: /\n\n${declarations.join('\n')}\n`);
      },
    },
  };
}
