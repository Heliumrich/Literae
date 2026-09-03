# Architecture statique

Literae privilégie la génération statique. Directus est une source de build, pas une dépendance d’exécution pour les pages éditoriales.

## Frontière d’exécution

| Élément | Moment d’exécution | Sortie |
|---|---|---|
| Pages Astro | Build | HTML statique |
| Œuvres, personnalités et prières Directus | Build | HTML et JSON statiques |
| Filtres, thème et visionneuse | Navigateur | JavaScript natif |
| Comparateur | Navigateur | Unique îlot Svelte |
| Requête de versets et navigation | Serveur | `/api/bible/verses` |

La liste des traductions est lue dans SQLite pendant le build, enrichie par `src/lib/bible-translations.ts`, puis sérialisée dans les propriétés de l’îlot. L’analyse des références bibliques se fait directement dans le navigateur. Une seule route ouvre donc `bible.db` à l’exécution.

## Mise à jour des contenus

Les listes et les fiches issues de Directus sont figées à chaque build. Après une modification du CMS, un nouveau `npm run build` publie le nouvel état. Les URLs d’assets Directus restent distantes afin de conserver les transformations d’images.

En cas d’indisponibilité temporaire de Directus, le build conserve les fallbacks prévus pour les pages principales, mais il est préférable de contrôler le nombre de pages générées avant déploiement.

## Garde-fou

`npm run check:static` vérifie automatiquement :

- `output: "static"` dans la configuration Astro ;
- un seul fichier avec `prerender = false` ;
- un seul composant hydraté, le comparateur Svelte ;
- le pré-rendu explicite des catalogues JSON.
