import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export default function comparatorPwa() {
  let client;
  return {
    name: 'literae-comparator-pwa',
    hooks: {
      'astro:config:done': ({ config }) => { client = fileURLToPath(config.build.client); },
      'astro:build:done': async ({ logger }) => {
        const paths = [];
        async function walk(relative) {
          for (const entry of await readdir(path.join(client, relative), { withFileTypes: true })) {
            const name = path.posix.join(relative, entry.name);
            if (entry.isDirectory()) await walk(name);
            else if (!name.endsWith('.map')) paths.push(name);
          }
        }
        await walk('_astro');
        await walk('fonts');
        await walk('textures');
        for (const entry of await readdir(path.join(client, 'scriptorium'))) {
          if (/^bible-worker-.*\.js$/.test(entry)) paths.push('scriptorium/' + entry);
        }
        paths.push('favicon.svg', 'scriptorium/manifest.webmanifest', 'scriptorium/icon-192.png', 'scriptorium/icon-512.png', 'scriptorium/apple-touch-icon.png');
        paths.sort();
        const hash = createHash('sha256');
        const page = await readFile(path.join(client, 'scriptorium/comparateur/index.html'));
        hash.update(page);
        for (const name of paths) hash.update(name).update(await readFile(path.join(client, name)));
        const template = await readFile(new URL('../src/lib/offline/sw.js', import.meta.url), 'utf8');
        hash.update(template);
        const assets = ['/scriptorium/comparateur', ...paths.map(name => '/' + name)];
        const worker = template.replace('__CACHE_VERSION__', hash.digest('hex').slice(0, 20)).replace('__PRECACHE__', JSON.stringify(assets));
        await writeFile(path.join(client, 'scriptorium/sw.js'), worker);
        logger.info(`Comparateur hors ligne : ${assets.length} ressources (Bible téléchargée séparément).`);
      },
    },
  };
}
