import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The comparator has one source: the snapshot prepared by bible:sync. */
export function resolveBibleSource(root = fileURLToPath(new URL('../../', import.meta.url))) {
  const manifest = path.join(root, 'data/french-bibles/current.json');
  if (!existsSync(manifest)) {
    throw new Error(`Source Bible absente : ${manifest}. Lancer npm run bible:sync avant de démarrer le comparateur.`);
  }
  const source = JSON.parse(readFileSync(manifest, 'utf8'));
  if (!/^[a-f0-9]{64}$/.test(source.sha256) || typeof source.version !== 'string') {
    throw new Error('Métadonnées French-Bibles invalides ; relancer npm run bible:sync.');
  }
  const file = path.join(root, 'data/french-bibles', source.sha256 + '.db');
  if (!existsSync(file)) throw new Error(`Copie French-Bibles manquante : ${file}`);
  return { path: file, version: String(source.version), sha256: String(source.sha256) };
}
