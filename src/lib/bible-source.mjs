import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Resolve the managed snapshot without changing a manually supplied database. */
export function resolveBibleSource(root = process.cwd(), override = process.env.BIBLE_DB) {
  if (override) {
    const file = path.resolve(root, override);
    if (!existsSync(file)) throw new Error(`BIBLE_DB introuvable : ${file}`);
    return { path: file, version: '', sha256: '' };
  }

  const manifest = path.join(root, 'data/french-bibles/current.json');
  if (existsSync(manifest)) {
    const source = JSON.parse(readFileSync(manifest, 'utf8'));
    if (!/^[a-f0-9]{64}$/.test(source.sha256) || typeof source.version !== 'string') {
      throw new Error('Métadonnées French-Bibles invalides ; relancer npm run bible:sync.');
    }
    const file = path.join(root, 'data/french-bibles', source.sha256 + '.db');
    if (!existsSync(file)) throw new Error(`Copie French-Bibles manquante : ${file}`);
    return { path: file, version: String(source.version), sha256: String(source.sha256) };
  }

  // Compatibility with existing VPS installations and development without a sync.
  for (const file of [path.join(root, 'data/bible.db'), path.join(root, 'bible.db'), '/var/www/scriptorium/data/bible.db']) {
    if (existsSync(file)) return { path: file, version: '', sha256: '' };
  }
  throw new Error('bible.db introuvable ; lancer npm run bible:sync.');
}
