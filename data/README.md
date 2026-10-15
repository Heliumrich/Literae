# Base biblique

La source est [Heliumrich/French-Bibles](https://github.com/Heliumrich/French-Bibles), fichier `bible.db` de la branche `main`.

## Synchronisation automatique

`npm run build` lance automatiquement `npm run bible:sync` avant Astro. Le script :

1. récupère le dernier commit de `main` dans un cache Git séparé ;
2. exporte `bible.db` tel que publié, sans ouvrir SQLite ni retester les données ;
3. conserve le fichier sous `data/french-bibles/<sha256>.db`, puis publie atomiquement `current.json`.

Le tag Git exact du commit donne la version affichée (par exemple `2.1.1`, y compris les tags annotés ou préfixés par `v`). Un commit non tagué est présenté comme `git-<commit>`, sans lui inventer une version de release. Le SHA-256 du fichier identifie toujours le contenu et renouvelle les URLs des versets et du téléchargement PWA. Une copie personnalisée sans métadonnées fiables affiche son empreinte au lieu d’une version supposée.

Les synchronisations suivantes réutilisent les objets Git et le fichier SQLite inchangé ; les anciennes bases de tous les tags ne sont pas téléchargées. Le répertoire géré et le cache Git sont ignorés par le dépôt Literae. Aucun jeton GitHub n’est nécessaire. Il faut Git, une connexion vers GitHub et de la place pour le cache, les snapshots et la copie statique du build.

Un échec de récupération Git arrête le build et conserve la sélection précédente. La base est testée dans French-Bibles avant publication ; Literae ne répète pas ces validations. Chaque build garde le chemin de son propre snapshot : une synchronisation ultérieure ne change pas la base d’un serveur déjà construit. Les anciennes copies restent disponibles pour le serveur en cours et pour un retour à un ancien build. Elles ne sont pas supprimées automatiquement ; elles peuvent être archivées ou supprimées après arrêt des processus qui les utilisent, en conservant les copies requises pour les retours arrière.

## Déploiement sur le VPS

```bash
git pull
npm ci
npm run build
# Redémarrer ensuite le service Node avec le gestionnaire utilisé sur le VPS.
```

Aucun `wget`, remplacement manuel ou suppression de fichiers SQLite n’est nécessaire. La synchronisation se produit au build, même si Literae n’a aucun nouveau commit : une nouvelle version de French-Bibles seule peut donc être intégrée avec `npm run build`, puis un redémarrage. Un `git pull` seul ne reconstruit pas le site et n’exécute pas la synchronisation. Un sous-module ordinaire suivrait lui aussi un commit fixé par Literae, pas automatiquement la dernière base de French-Bibles.

Pour préparer uniquement la base : `npm run bible:sync`. Après toute mise à jour destinée à la production, reconstruire et redémarrer afin de garder les traductions, la navigation, l’API et le téléchargement PWA cohérents.

## Installations existantes et copie personnalisée

Le fichier historique `data/bible.db` reste intact et sert de repli avant la première synchronisation, notamment en développement. Il n’est pas nécessaire de le remplacer pour adopter ce fonctionnement. Chaque connexion serveur utilise l’URI SQLite `mode=ro&immutable=1`, `readonly: true` et `query_only = ON`. SQLite lit uniquement le fichier publié, sans créer ni utiliser de fichiers `-wal` ou `-shm`, sans journal ni verrous de base de données. Ce mode ne sérialise pas les lectures entre utilisateurs et évite les vérifications de modification du fichier. Les fichiers annexes d’une ancienne installation ne sont plus utilisés ; ils ne sont pas supprimés automatiquement.

Le paramètre `immutable` est adapté aux snapshots : une mise à jour crée un autre fichier et le nouveau build utilise ce nouveau chemin. La version précédente reste inchangée. Une copie personnalisée via `BIBLE_DB` doit elle aussi être un fichier autonome et figé, sans transactions à récupérer depuis un WAL ; ne pas la modifier en place pendant son utilisation.

`BIBLE_DB=/chemin/absolu/bible.db`, dans l’environnement ou `.env`, choisit explicitement une copie personnalisée et **désactive la synchronisation automatique**. Retirer cette variable sur le VPS pour suivre French-Bibles automatiquement. Une valeur définie avec un fichier manquant échoue clairement. Utiliser la même configuration au build et au démarrage du serveur.

La base est ouverte en lecture seule par l’API. La PWA télécharge séparément une copie complète, sur demande ; les mises à jour du VPS ne remplacent jamais automatiquement celle du téléphone. Les préférences utilisent les codes stables des traductions, leurs identifiants numériques pouvant changer entre versions.
