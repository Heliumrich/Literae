# Literae

> *Tolle, lege — prends et lis.*

Literae est un atelier catholique francophone pour lire la Sainte Écriture, contempler l’art chrétien et prier avec les mots de l’Église.

- Site principal : [literae.ch](https://literae.ch)
- Galerie : [art.literae.ch](https://art.literae.ch)
- Données éditoriales : [api.literae.ch](https://api.literae.ch)
- Source de la base biblique : [French-Bibles](https://github.com/Heliumrich/French-Bibles)

## Ce que contient le projet

- un comparateur de traductions bibliques, présenté comme un pupitre en pages vis-à-vis ;
- une galerie d’œuvres chrétiennes reliées à leurs artistes et aux figures représentées ;
- un mémento de prières françaises et latines ;
- une collection musicale d’albums et d’artistes, avec leurs présentations, contributions et liens d’écoute ;
- deux thèmes de lecture : Parchemin et Nuit ;
- des espaces réservés pour la bibliothèque et le calendrier liturgique.

## Architecture

Le site est conçu pour être statique partout où cela est possible.

| Partie | Exécution | Technologie |
|---|---|---|
| Pages, œuvres, personnalités, prières et musique | Générées au build | Astro |
| Catalogues de filtrage | JSON statique généré au build | Astro + JavaScript natif |
| Thème, filtres et visionneuse | Dans le navigateur, sans framework | TypeScript |
| Comparateur biblique | Unique îlot hydraté | Svelte |
| Lecture des versets et navigation | Unique route serveur | Node.js + SQLite |

Directus n’est interrogé que pendant `npm run build`. Une modification d’œuvre, de personnalité ou de prière devient donc publique au prochain build, sans appel au CMS lors de la consultation des pages.

La page du comparateur est elle aussi prérendue. La liste des traductions et l’index des livres et chapitres sont extraits de SQLite au build et transmis à l’îlot Svelte. Le sélecteur de passage présente les livres par Testament, puis leurs chapitres, sans requête avant le choix du chapitre à lire. Seul `/api/bible/verses` ouvre `bible.db` à l’exécution.

Le script `npm run check:static` protège cette frontière : il échoue si une seconde route devient dynamique, si un autre îlot est hydraté ou si un catalogue JSON cesse d’être prérendu. Le détail est documenté dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Prérequis

- Node.js `22.12` ou plus récent ;
- npm et Git ;
- un accès à GitHub pour synchroniser automatiquement la base [French-Bibles](https://github.com/Heliumrich/French-Bibles) au build.

## Installation locale

```bash
git clone https://github.com/Heliumrich/Literae.git
cd Literae
npm ci
cp .env.example .env
npm run bible:sync
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
| `npm run build` | Synchronisation de French-Bibles, puis génération du site et du serveur minimal |
| `npm run bible:sync` | Préparation de la dernière base sans reconstruire le site |
| `npm run preview` | Prévisualisation du résultat de build |
| `npm start` | Démarrage de `dist/server/entry.mjs` |

## Variables d’environnement

Toutes les variables sont facultatives dans la configuration actuelle.

| Variable | Valeur par défaut | Description |
|---|---|---|
| `DIRECTUS_URL` | `https://api.literae.ch` | URL publique de Directus |
| `DIRECTUS_TOKEN` | — | Jeton de lecture si le rôle public ne suffit pas |
| `BIBLE_DB` | Snapshot French-Bibles géré | Copie personnalisée ; désactive la synchronisation automatique |
| `PUBLIC_MAIN_SITE_URL` | `https://literae.ch` | Origine publique du site principal |
| `PUBLIC_ART_SITE_URL` | `https://art.literae.ch` | Origine publique de la galerie |

Ne commitez jamais de fichier `.env` ni de jeton Directus.

## Données Directus

Les collections actuellement consommées sont :

- `artworks` pour les œuvres, leurs images, titres, datations, notices et relations ;
- `artists` pour les artistes, saints, souverains et écrivains ;
- `prayers` pour les titres, textes français et latins, descriptions et étiquettes.
- `albums` et `musical_artists` pour la collection musicale ; la relation `albums.artists` expose les participations et leurs `roles`.

Les fiches musicales affichent les descriptions Markdown, les tags et les liens externes renseignés dans le CMS. Les types généraux des artistes sont distincts de leurs rôles sur chaque album. Seuls les albums et artistes `published` sont exposés, y compris dans les relations. Les filtres (recherche, tags, types et artiste associé) utilisent `/musique/albums.json` et `/musique/artistes.json`, générés au build. Aucun lecteur embarqué ou import de pistes n’est utilisé.

Seuls les éléments dont le statut est `published` sont intégrés. Les collections sont lues par pages de 100 éléments afin d’accompagner leur croissance. Les requêtes identiques sont mutualisées pendant le build.

Les images restent servies par Directus avec les transformations `thumbnail`, `medium`, `large` et `xlarge`. Le fichier original n’est demandé que depuis la visionneuse lorsque **Qualité originale** est activée.

Le catalogue des œuvres alterne les artistes dans l’ordre alphabétique de leur nom affiché (A à Z, tri français) : une œuvre de chacun, puis la suivante, jusqu’à épuisement de toutes les œuvres. Les œuvres d’un même artiste restent classées par ajout récent. Cet ordre est calculé au build et conservé dans le JSON statique ; les résultats filtrés sont également triés et alternés avant pagination. Les vignettes présentent l’œuvre entière dans un cadre carré.

La visionneuse navigable du catalogue et des collections d’une personnalité précharge uniquement l’image suivante dans la qualité sélectionnée. Depuis une fiche d’œuvre, elle utilise une vue épurée, sans légende ni navigation. Le bouton **Épique**, réservé aux œuvres attribuées à Gustave Doré, applique une courbe en S avec un filtre SVG côté navigateur ; les fichiers Directus et les téléchargements restent inchangés.

## Comparateur sur smartphone et hors ligne

Le comparateur est une PWA installable : invitation native sur Android lorsque le navigateur le permet, instructions Safari sur iPhone/iPad. Le panneau **Emporter le comparateur** permet de télécharger toutes les traductions (environ 51 Mo pour la version 2.1.1), suivre le transfert et supprimer la copie locale. Après téléchargement, le lecteur fonctionne sans connexion, y compris pour des passages jamais consultés.

Le seul panneau **Emporter le comparateur** regroupe le téléchargement puis l’installation. Le téléchargement fonctionne aussi directement dans l’application installée ; aucune étape préalable dans le navigateur n’est obligatoire.

La PWA vérifie les releases de [French-Bibles](https://github.com/Heliumrich/French-Bibles) à l’ouverture et propose les mises à jour avec leur taille, sans téléchargement automatique. Les transferts GitHub passent par le VPS via l’API existante, pour éviter les erreurs de téléchargement inter-domaines. L’interface et ses polices se mettent à jour séparément de la Bible. Le site classique conserve sa navigation et sa base serveur.

La version installée réutilise le même comparateur Svelte. Le stockage dépend des quotas et de l’espace de l’appareil ; il peut être libéré par le système. L’installation sur iOS doit être suivie du téléchargement depuis l’application ouverte sur l’écran d’accueil.

Voir [PWA : utilisation, déploiement et tests](docs/PWA.md).

## Base biblique

`npm run build` récupère automatiquement `bible.db` depuis la branche `main` de [French-Bibles](https://github.com/Heliumrich/French-Bibles) et prépare un snapshot versionné dans `data/french-bibles/`. Le tag réel fournit la version affichée ; le SHA-256 du fichier identifie son contenu et renouvelle les caches, sans constante à modifier à la main.

Les anciennes copies restent disponibles pour les serveurs en cours et les retours arrière. Le fichier historique `data/bible.db` et ses fichiers SQLite annexes restent intacts. `BIBLE_DB` permet de conserver une copie personnalisée et désactive cette synchronisation. Voir [gestion de la base et déploiement VPS](data/README.md).

La PWA continue à proposer séparément les nouvelles releases à l’utilisateur. Une mise à jour du serveur ou de l’interface ne force jamais le téléchargement de la base sur le téléphone.

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
| `/musique` | Accueil de la collection musicale |
| `/musique/albums` et `/musique/albums/[slug]` | Catalogue des albums et fiches avec crédits et liens d’écoute |
| `/musique/artistes` et `/musique/artistes/[slug]` | Catalogue des artistes musicaux et albums associés |
| `/a-propos` | Présentation et colophon |
| `/api/bible/verses` | Seule route exécutée côté serveur |

Les anciennes URLs sous `/art/oeuvres`, `/art/personalites`, `/art/artworks` et `/art/artists` sont conservées sous forme de redirections.

## Déploiement

Le build produit :

- `dist/client`, qui contient toutes les pages et ressources statiques ;
- `dist/server`, qui contient le serveur Node minimal nécessaire au seul endpoint SQLite.

```bash
git pull
npm ci
npm run build
# Redémarrer le service Node existant, ou lancer :
npm start
```

Le processus doit être lancé depuis la racine du projet. Le build inclut le chemin du snapshot SQLite utilisé pour générer le comparateur ; reconstruire puis redémarrer applique une nouvelle base. Un `git pull` seul ne déclenche pas le build. Après chaque changement dans Directus, reconstruisez puis redéployez le site.

La CI GitHub exécute automatiquement les contrôles TypeScript, la vérification de la frontière statique et le build sur les pushes vers `main` et les pull requests.
