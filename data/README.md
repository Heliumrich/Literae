# Base biblique

Le comparateur attend une base SQLite à l’emplacement `data/bible.db`.

La base est issue du projet [FR-Bibles_JSON](https://github.com/Heliumrich/FR-Bibles_JSON). Elle est ouverte en lecture seule par le serveur et n’est jamais envoyée au navigateur.

Version intégrée : [1.1.0](https://github.com/Heliumrich/FR-Bibles_JSON/releases/tag/1.1.0), publiée le 11 octobre 2026.

- Fichier : `bible.db` (52 518 912 octets).
- SHA-256 : `e6bb5b1445067fb229be675f4d3c798c14a7663b11db04f48431745ba70a5f81`.
- Traductions : Tours, Fillion, Crampon, Glaire, Vulgate et Sacy.

Les préférences du comparateur utilisent les codes des traductions, car leurs identifiants numériques peuvent changer entre releases. Les anciennes préférences sont migrées depuis les identifiants de la base précédente. À chaque remplacement de la base, mettre aussi à jour `BIBLE_DATA_VERSION` dans `src/lib/bible-translations.ts` pour renouveler les URLs des versets et éviter les réponses de l’ancienne base conservées en cache.

La release signale des défauts de données encore présents : décalages dans les Psaumes, découpage de certains versets (notamment Crampon dans le Siracide et la Vulgate dans d’autres livres), et astérisques superflus chez Fillion. L’intégration conserve le fichier officiel sans modifier ces textes.

Pour utiliser une autre copie sans remplacer le fichier du dépôt, définissez `BIBLE_DB` dans `.env` avec un chemin absolu.

Après une mise à jour du schéma ou des données, exécutez au minimum :

```bash
npm run check
npm run build
```
