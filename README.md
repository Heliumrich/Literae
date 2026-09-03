# Literae

> *Tolle, lege — prends et lis.*

Literae est un atelier catholique francophone pour lire la Sainte Écriture, contempler l’art chrétien et prier avec les mots de l’Église.

- Site principal : [literae.ch](https://literae.ch)
- Galerie : [art.literae.ch](https://art.literae.ch)
- Données éditoriales : [api.literae.ch](https://api.literae.ch)
- Source de la base biblique : [FR-Bibles_JSON](https://github.com/Heliumrich/FR-Bibles_JSON)

## Ce que contient le projet

- un comparateur de traductions bibliques, présenté comme un pupitre en pages vis-à-vis ;
- une galerie d’œuvres chrétiennes reliées à leurs artistes et aux figures représentées ;
- un mémento de prières françaises et latines ;
- deux thèmes de lecture : Parchemin et Nuit ;
- des espaces réservés pour la bibliothèque, le calendrier liturgique et la musique sacrée.

## Architecture

Le site est conçu pour être statique partout où cela est possible.

| Partie | Exécution | Technologie |
|---|---|---|
| Pages, œuvres, personnalités et prières | Générées au build | Astro |
| Catalogues de filtrage | JSON statique généré au build | Astro + JavaScript natif |
| Thème, filtres et visionneuse | Dans le navigateur, sans framework | TypeScript |
| Comparateur biblique | Unique îlot hydraté | Svelte |
| Lecture des versets et navigation | Unique route serveur | Node.js + SQLite |

Directus n’est interrogé que pendant `npm run build`. Une modification d’œuvre, de personnalité ou de prière devient donc publique au prochain build, sans appel au CMS lors de la consultation des pages.

La page du comparateur est elle aussi prérendue. La liste des traductions est extraite de SQLite au build et transmise à l’îlot Svelte. Seul `/api/bible/verses` ouvre `bible.db` à l’exécution.

Le script `npm run check:static` protège cette frontière : il échoue si une seconde route devient dynamique, si un autre îlot est hydraté ou si un catalogue JSON cesse d’être prérendu. Le détail est documenté dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Prérequis

- Node.js `22.12` ou plus récent ;
- npm ;
- `data/bible.db`, inclus dans le projet ou remplacé par une base compatible issue de [FR-Bibles_JSON](https://github.com/Heliumrich/FR-Bibles_JSON).

## Installation locale

```bash
git clone https://github.com/Heliumrich/Literae.git
cd Literae
npm ci
cp .env.example .env
npm run dev
```

Le site est ensuite disponible sur l’adresse indiquée par Astro, généralement `http://localhost:4321`.

En développement, les liens entre le site principal et la galerie restent locaux. Pour tester un build de production sur un seul domaine, adaptez `PUBLIC_MAIN_SITE_URL` et `PUBLIC_ART_SITE_URL` dans `.env` avant le build.

## Commandes

| Commande | Usage |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run check` | TypeScript strict et contrôle de la frontière statique |
| `npm run check:static` | Contrôle architectural seul |
| `npm run build` | Génération du site et du serveur minimal |
| `npm run preview` | Prévisualisation du résultat de build |
| `npm start` | Démarrage de `dist/server/entry.mjs` |

## Variables d’environnement

Toutes les variables sont facultatives dans la configuration actuelle.

| Variable | Valeur par défaut | Description |
|---|---|---|
| `DIRECTUS_URL` | `https://api.literae.ch` | URL publique de Directus |
| `DIRECTUS_TOKEN` | — | Jeton de lecture si le rôle public ne suffit pas |
| `BIBLE_DB` | `data/bible.db` | Chemin alternatif vers la base SQLite |
| `PUBLIC_MAIN_SITE_URL` | `https://literae.ch` | Origine publique du site principal |
| `PUBLIC_ART_SITE_URL` | `https://art.literae.ch` | Origine publique de la galerie |

Ne commitez jamais de fichier `.env` ni de jeton Directus.

## Données Directus

Les collections actuellement consommées sont :

- `artworks` pour les œuvres, leurs images, titres, datations, notices et relations ;
- `artists` pour les artistes, saints, souverains et écrivains ;
- `prayers` pour les titres, textes français et latins, descriptions et étiquettes.

Seuls les éléments dont le statut est `published` sont intégrés. Les collections sont lues par pages de 100 éléments afin d’accompagner leur croissance. Les requêtes identiques sont mutualisées pendant le build.

Les images restent servies par Directus avec les transformations `thumbnail`, `medium`, `large` et `xlarge`. Le fichier original n’est demandé que depuis la visionneuse lorsque **Qualité originale** est activée.

## Base biblique

`data/bible.db` est toujours ouverte en lecture seule et n’est jamais envoyée au navigateur. Les métadonnées éditoriales encore absentes de la base sont temporairement complétées dans `src/lib/bible-translations.ts`.

Pour remplacer la base :

1. copiez le nouveau fichier vers `data/bible.db`, ou définissez `BIBLE_DB` ;
2. lancez `npm run check` ;
3. lancez `npm run build` ;
4. contrôlez le comparateur sur plusieurs livres et traductions.

## Organisation du dépôt

```text
.
├── .github/workflows/       CI GitHub Actions
├── data/                    base SQLite et documentation associée
├── docs/                    choix d’architecture
├── public/                  icônes, textures et polices locales
├── scripts/                 garde-fous du dépôt
└── src/
    ├── components/          composants Astro et îlot Svelte
    ├── layouts/             structure HTML partagée
    ├── lib/                 Directus, Bible, catalogues et utilitaires
    ├── pages/               routes Astro et unique endpoint serveur
    └── styles/              tokens, thèmes et styles globaux
```

## Routes principales

| Route | Contenu |
|---|---|
| `/` | Accueil éditorial |
| `/scriptorium` | Présentation du pupitre de lecture |
| `/scriptorium/comparateur` | Comparateur biblique |
| `/scriptorium/bibliotheque` | Bibliothèque, espace réservé |
| `/art` | Accueil local de la galerie |
| `/oeuvres` et `/oeuvres/[slug]` | Catalogue et fiches d’œuvres |
| `/personalites` et `/personalites/[slug]` | Catalogue et notices biographiques |
| `/prieres` et `/prieres/[slug]` | Mémento et lectures bilingues |
| `/calendrier` | Calendrier liturgique, espace réservé |
| `/musique` | Musique sacrée, espace réservé |
| `/a-propos` | Présentation et colophon |
| `/api/bible/verses` | Seule route exécutée côté serveur |

Les anciennes URLs sous `/art/oeuvres`, `/art/personalites`, `/art/artworks` et `/art/artists` sont conservées sous forme de redirections.

## Déploiement

Le build produit :

- `dist/client`, qui contient toutes les pages et ressources statiques ;
- `dist/server`, qui contient le serveur Node minimal nécessaire au seul endpoint SQLite.

```bash
npm run build
npm start
```

Le processus doit être lancé depuis la racine du projet, ou recevoir `BIBLE_DB`, afin que la base SQLite soit trouvée. Après chaque changement dans Directus, reconstruisez puis redéployez le site.

La CI GitHub exécute automatiquement les contrôles TypeScript, la vérification de la frontière statique et le build sur les pushes vers `main` et les pull requests.
