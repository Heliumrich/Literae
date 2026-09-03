# Base biblique

Le comparateur attend une base SQLite à l’emplacement `data/bible.db`.

La base est issue du projet [FR-Bibles_JSON](https://github.com/Heliumrich/FR-Bibles_JSON). Elle est ouverte en lecture seule par le serveur et n’est jamais envoyée au navigateur.

Pour utiliser une autre copie sans remplacer le fichier du dépôt, définissez `BIBLE_DB` dans `.env` avec un chemin absolu.

Après une mise à jour du schéma ou des données, exécutez au minimum :

```bash
npm run check
npm run build
```
