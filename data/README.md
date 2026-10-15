# Base biblique

La seule source du comparateur est `data/french-bibles/<sha256>.db`, récupérée depuis [Heliumrich/French-Bibles](https://github.com/Heliumrich/French-Bibles), fichier `bible.db` de la branche `main`. Le fichier historique `data/bible.db` a été supprimé du dépôt. Aucun repli ni variable `BIBLE_DB` ne sélectionne une autre base.

## Synchronisation et lecture

`npm run build` lance automatiquement `npm run bible:sync` avant Astro. Le script récupère `main` dans un cache Git séparé, exporte le fichier publié et écrit `data/french-bibles/current.json`. Il n’ouvre pas SQLite et ne reteste ni les données ni le schéma déjà testés avant publication dans French-Bibles. Un fichier inchangé est réutilisé.

Le tag Git exact donne la version affichée (par exemple `2.1.1`). Un commit non tagué affiche `git-<commit>`. Le SHA-256 identifie le contenu et renouvelle les URLs et caches. Le répertoire géré et le cache Git sont ignorés par Literae ; aucun jeton GitHub n’est nécessaire.

Le build mémorise le **chemin absolu** du snapshot utilisé pour générer le comparateur. Le serveur retrouve donc sa base même si PM2/systemd le démarre depuis un autre dossier. Après déplacement du dépôt vers un autre chemin, reconstruire le site. Une nouvelle synchronisation ne change pas la source d’un serveur déjà construit ; les anciens snapshots restent disponibles pour les processus en cours et les retours arrière.

Le site classique ouvre ce fichier avec `mode=ro&immutable=1`, `readonly: true` et `query_only = ON`. Il n’écrit pas dans la base, ne crée ni n’utilise de `-wal` ou `-shm` et ne prend pas de verrous SQLite. Le snapshot reste figé ; une mise à jour crée un autre fichier. Au premier accès, les logs indiquent `[Bible] <chemin absolu> (mode=ro, immutable=1)`.

La PWA utilise les mêmes données : le build exporte une copie statique dans `dist/client/scriptorium/donnees/` pour le téléchargement sur téléphone. Le lecteur installé interroge ensuite sa copie locale en mémoire avec SQLite WebAssembly, en lecture seule. Les mises à jour du VPS ne forcent pas le téléchargement sur téléphone.

## Déploiement sur le VPS

Lors du passage depuis l’ancienne version, supprimer l’ancienne copie avant le pull évite un conflit Git si elle avait été remplacée manuellement :

```bash
cd /var/www/literae
rm -f data/bible.db data/bible.db-wal data/bible.db-shm
git pull
npm ci
npm run build
# Redémarrer ensuite le service Node utilisé sur le VPS.
```

Aucun `.env` n’est nécessaire pour la Bible. Aucun `wget` ni nettoyage SQLite n’est nécessaire aux mises à jour suivantes. Un échec de récupération Git arrête le build et conserve la sélection précédente.

Une nouvelle version de French-Bibles seule peut être intégrée avec `npm run build`, puis un redémarrage. `git pull` seul ne reconstruit pas le site. Pour préparer uniquement la base : `npm run bible:sync`.

Les anciennes copies peuvent être supprimées après arrêt des processus qui les utilisent, en conservant les fichiers requis pour les retours arrière. Ne jamais modifier en place un snapshot ouvert en mode immutable.
