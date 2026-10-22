# Architecture statique

Literae privilégie la génération statique. Directus est une source de build, pas une dépendance d’exécution pour les pages éditoriales.

## Frontière d’exécution

| Élément | Moment d’exécution | Sortie |
|---|---|---|
| Pages Astro | Build | HTML statique |
| Œuvres, personnalités, prières, musique et ouvrages Directus | Build | HTML et JSON statiques |
| Filtres, thème et visionneuse | Navigateur | JavaScript natif |
| Lecteur des ouvrages | Navigateur | TypeScript natif + EPUB.js, sur les fiches uniquement |
| Comparateur | Navigateur | Unique îlot Svelte |
| Requête de versets et navigation | Serveur | `/api/bible/verses` |

La liste des traductions est lue dans SQLite pendant le build, enrichie par `src/lib/bible-translations.ts`, puis sérialisée dans les propriétés de l’îlot. L’analyse des références bibliques se fait directement dans le navigateur. Une seule route ouvre donc la base serveur `bible.db` à l’exécution. Le mode [PWA hors ligne](PWA.md) propose séparément une copie statique versionnée de cette base, interrogée par SQLite WebAssembly dans un worker du navigateur. Les requêtes SQL et la navigation sont partagées avec la route Node dans `bible-query.ts`. Cette même route accepte aussi les paramètres PWA de vérification et de transfert ; `releases-route.ts` et `releases-server.ts` isolent ce relais GitHub côté Node. Le téléphone ne télécharge pas directement depuis GitHub.

L’ordre des livres, leurs noms français, leur Testament et la longueur des chapitres sont également extraits au build. Ce petit index, sans texte biblique, alimente le sélecteur de livres et chapitres sans appel réseau et permet au comparateur de calculer les passages précédent et suivant si l’API déployée ne renvoie pas encore le champ `navigation`. Les destinations renvoyées par l’API restent prioritaires lorsqu’elles sont présentes.

## Mise à jour des contenus

La bibliothèque conserve cette frontière : `books-server.ts` lit les ouvrages non archivés, leur auteur publié et leurs fichiers EPUB. Les routes `/scriptorium/bibliotheque/fichiers/[asset].epub` sont prérendues et copient les fichiers pendant le build : aucun nouvel endpoint dynamique ni jeton CMS côté client. Les URL d’EPUB comprennent une révision de leurs métadonnées. `books.ts` partage le rendu échappé des cartes entre Astro et les filtres natifs. Le lecteur et ses réglages sont isolés dans `src/lib/reader/`, sans second framework ni nouvel îlot hydraté. Un signet local par UUID de livre est commun à ses traductions ; les CFIs restent propres à chaque édition et les changements d’édition passent par la section et sa position relative. Les polices optionnelles sont placées dans `public/reader-fonts/`, hors du précache du comparateur, et injectées dans les cadres EPUB seulement à la sélection.

La musique conserve la même frontière : `music-server.ts` lit les artistes publiés et les albums avec leurs participations via `albums.artists`. Les relations sont croisées avec les artistes publiés, sans exposer les brouillons. Les descriptions Markdown sont rendues au build avec `micromark` (HTML brut et protocoles dangereux désactivés). `music-client.ts` filtre uniquement les catalogues JSON statiques et partage le rendu des cartes avec le pré-rendu. Les liens YouTube, Spotify et sites officiels sont des liens externes HTTP(S), sans SDK de lecture.

Les listes et les fiches issues de Directus sont figées à chaque build. Après une modification du CMS, un nouveau `npm run build` publie le nouvel état. Les URLs d’assets Directus restent distantes afin de conserver les transformations d’images.

En cas d’indisponibilité temporaire de Directus, le build conserve les fallbacks prévus pour les pages principales, mais il est préférable de contrôler le nombre de pages générées avant déploiement.

## Garde-fou

`npm run check:static` vérifie automatiquement :

- `output: "static"` dans la configuration Astro ;
- un seul fichier avec `prerender = false` ;
- un seul composant hydraté, le comparateur Svelte ;
- le pré-rendu explicite des catalogues JSON.
