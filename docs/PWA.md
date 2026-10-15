# Comparateur installable et hors ligne

Le comparateur reste l’unique îlot Svelte du site. La version installée utilise ce même composant, ses styles, le sélecteur de passages et ses préférences. Il n’y a pas d’application Android/iOS à maintenir en parallèle.

## Utilisation

Sur Android, un navigateur compatible peut afficher **Installer le comparateur**. L’invitation native s’ouvre uniquement après un clic. L’option d’installation reste aussi accessible dans le menu du navigateur ; sa disponibilité dépend du navigateur et de ses critères d’installation.

Sur iPhone/iPad, le panneau explique l’ajout depuis Safari : **Partager → Sur l’écran d’accueil**. iOS ne fournit pas l’événement `beforeinstallprompt` d’Android. Ouvrir ensuite l’application depuis son icône, puis y télécharger la Bible : selon la version d’iOS, l’application installée peut avoir un stockage distinct du navigateur.

Dans **Emporter le comparateur**, **Télécharger la Bible** conserve toutes les traductions sur l’appareil. La taille exacte est affichée avant le téléchargement (52,5 Mo avec la base intégrée). Le lecteur, les polices et ses autres ressources locales sont également conservés. Un passage jamais consulté reste disponible après fermeture et réouverture sans réseau. La galerie et les autres pages éditoriales ne font pas partie du mode hors ligne. En mode installé, le header ne contient que le logo et le nom Literae, sans lien. L’introduction et la navigation du site disparaissent ; le footer se limite à « Literae · Tolle, lege ». Le site classique conserve son habillage complet sur ordinateur et mobile et continue de lire les versets sur le serveur, même si la PWA a téléchargé une autre version.

Le téléchargement affiche sa progression, permet l’annulation pendant le transfert et vérifie la taille, le SHA-256 et l’intégrité SQLite avant enregistrement. Une copie complète remplace l’ancienne dans une transaction IndexedDB ; une mise à jour interrompue conserve l’ancienne base. **Supprimer la copie locale** libère le stockage de la Bible sans désinstaller l’application.

## Mises à jour de la Bible

Dans la PWA installée uniquement, une requête JSON publique vers `https://api.github.com/repos/Heliumrich/French-Bibles/releases/latest` vérifie la dernière release stable à chaque ouverture, retour au premier plan ou retour du réseau. Les vérifications simultanées sont regroupées ; il n’y a ni polling périodique ni téléchargement automatique de la base. Une vérification manuelle reste disponible dans **Bible hors ligne**.

La version de release (par exemple `2.1.1`) est affichée. Le SHA-256 de l’asset `bible.db` identifie le contenu : un simple changement d’étiquette sans changement du fichier ne déclenche aucun téléchargement. La taille exacte vient des métadonnées de l’asset GitHub. Les dernières métadonnées vérifiées et leur date sont conservées localement ; les erreurs réseau ou limites de l’API publique ne suppriment jamais la Bible locale.

Un avis intégré au lecteur présente la version disponible, la taille en Mo, **Mettre à jour la Bible** et **Plus tard**. Il s’adapte aux orientations portrait et paysage. Reporter n’efface pas la mise à jour : le bouton reste dans le menu et l’avis revient à la prochaine ouverture ou au retour au premier plan tant que la copie n’a pas été mise à jour. Aucun changelog n’est affiché et aucune permission de notification système n’est demandée.

Le téléchargement utilise l’API d’asset GitHub avec `Accept: application/octet-stream`, qui permet les requêtes CORS, puis suit les redirections vers l’hébergement des assets. Aucun jeton GitHub n’est nécessaire. La taille, le SHA-256, l’intégrité SQLite et les colonnes attendues sont vérifiés avant de remplacer la copie précédente. Une release dont le schéma est incompatible est refusée en conservant l’ancienne copie. Les identifiants des traductions sont retrouvés par leur code stable.

Cette vérification est indépendante de la version de la base déployée sur le VPS. Elle permet de mettre à jour la PWA à partir de French-Bibles sans redéployer le site. Au premier téléchargement, si les métadonnées GitHub ne peuvent pas être récupérées, la copie statique incluse dans le site reste disponible.

## Stockage et limites

Il n’y a pas de seuil PWA universel à 50 ou 100 Mo. L’application utilise IndexedDB pour conserver `bible.db` et demande le stockage persistant lorsque l’API du navigateur le permet. Elle contrôle l’espace disponible avant un téléchargement, traite les refus de stockage et n’impose aucun plafond fixe à la taille du fichier.

Le moteur SQLite WebAssembly (`sql.js`) s’exécute dans un worker pour préserver la réactivité de l’interface. Il charge la base en mémoire : prévoir davantage de RAM que la seule taille du fichier, particulièrement pendant une mise à jour. Les capacités réelles dépendent du téléphone et du navigateur. Un test sur appareils physiques reste nécessaire avant de promettre un support matériel précis.

Le stockage persistant reste une décision du navigateur. Le système peut effacer les données, notamment si le téléphone manque de place, et l’utilisateur peut les supprimer dans ses réglages. Le mode privé peut refuser le stockage. L’installation et le téléchargement se font donc explicitement ; le site en ligne reste utilisable sans eux.

## Build et déploiement VPS

Le déploiement conserve les commandes habituelles :

```bash
npm ci
npm run check
npm run build
npm start
```

Le build ajoute à `dist/client` :

- `/scriptorium/manifest.webmanifest`, les icônes et `/scriptorium/sw.js` ;
- `/scriptorium/bible-worker-<hash>.js` et le moteur WASM dans `/_astro` ;
- `/scriptorium/donnees/<sha256>.db`, copie statique de la base sélectionnée par `BIBLE_DB` ou de `data/bible.db`.

La base source ne change pas. Son contenu devient téléchargeable publiquement pour permettre le mode hors ligne. La seule route serveur reste `/api/bible/verses` ; la copie hors ligne n’ajoute aucune requête Directus ni service permanent.

Le domaine doit être servi en HTTPS (localhost est accepté pour les tests). Le reverse proxy doit servir les fichiers statiques de `dist/client`, dont les nouveaux chemins ci-dessus, comme les ressources existantes. Ne pas appliquer de cache immuable à `sw.js`, au manifest ou à la page HTML ; les fichiers contenant leur empreinte dans le nom peuvent être mis en cache longtemps. Le worker est enregistré avec `updateViaCache: 'none'`. Servir le WASM avec `application/wasm`, le manifest avec `application/manifest+json` et le service worker comme JavaScript. Aucune configuration COOP/COEP n’est requise.

Une politique CSP personnalisée doit autoriser les workers de même origine et WebAssembly (`worker-src 'self'` et `script-src 'wasm-unsafe-eval'` dans les directives existantes). Le lecteur déjà téléchargé ne dépend d’aucun domaine externe. En ligne, les vérifications et téléchargements GitHub nécessitent `connect-src` vers `https://api.github.com` et `https://release-assets.githubusercontent.com` dans une éventuelle CSP personnalisée, en plus des sources existantes.

Après un changement de code, le build génère un cache de ressources versionné. La nouvelle version s’installe entièrement avant de proposer **Actualiser l’application**. La mise à jour se fait sur action explicite pour éviter de remplacer le lecteur au milieu d’une lecture. L’actualisation recharge aussi les autres onglets ouverts du lecteur pour garder les ressources cohérentes. La copie biblique est conservée séparément des caches de l’interface. Une nouvelle release GitHub dont l’empreinte diffère de la copie locale propose **Mettre à jour la Bible**, sans imposer un nouveau téléchargement à chaque déploiement de l’interface. Les traductions sont retrouvées par leur code stable, même si les identifiants numériques d’une ancienne base diffèrent.

## Validation

```bash
npx playwright install chromium
npm run build
npm run test:pwa
```

Le serveur de test utilise le build sur le port 4322. Un Chromium système peut être sélectionné avec `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/chemin/vers/chromium`.

Les tests vérifient la comparaison avec l’API Node, la réouverture hors ligne, des chapitres et traductions jamais lus, la navigation, la reprise après transfert interrompu, la conservation de l’ancienne base, la suppression et les interfaces d’installation. Les tests des releases simulent les réponses et téléchargements GitHub avec de vraies bases SQLite, dont une avec des identifiants de traductions modifiés. Ils vérifient les rappels après report, l’absence de trafic GitHub dans le navigateur classique, le mode compact, les polices à froid hors ligne et la conservation de la Bible pendant une mise à jour de l’interface. L’interface iPhone est simulée dans Chromium ; ce test ne remplace pas une validation Safari sur un iPhone réel.

Sur Android et sur iPhone, contrôler également l’installation depuis le site HTTPS, le téléchargement depuis l’application installée, la fermeture complète, puis la réouverture en mode avion. Tester les futures bases plus volumineuses sur les appareils ciblés, ainsi qu’un refus de stockage et une mise à jour avec une connexion interrompue.

## Organisation du code PWA

- `src/components/bible/ComparatorAppChrome.astro` : habillage réservé au mode installé ; les deux slots de `BaseLayout` restent vides ailleurs.
- `src/lib/offline/display-mode.ts` : détection du mode installé, sans le confondre avec une petite fenêtre ou le plein écran du navigateur.
- `src/lib/offline/releases.ts` : métadonnées GitHub, validation et conservation du dernier résultat.
- `src/components/bible/OfflinePanel.svelte` : installation, état de la copie locale, avis et actions de l’utilisateur.
- `src/lib/offline/bible.worker.ts` et `storage.ts` : SQLite, téléchargement vérifié et remplacement atomique dans IndexedDB.
- `src/lib/offline/sw.js` et `scripts/comparator-pwa.mjs` : cache versionné de l’interface, des polices et des ressources locales. La base est stockée séparément et n’appartient jamais à ce cache.

Les quatre familles utilisées par le comparateur (Source Serif 4, Cormorant Garamond, Source Sans 3 et Cinzel), ainsi que les variantes locales, sont précachées depuis `public/fonts`. Les tests vérifient leur présence dans CacheStorage et leur chargement après réouverture sans réseau, avec le cache HTTP désactivé.
