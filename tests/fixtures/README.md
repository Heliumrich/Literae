# EPUB de validation du lecteur

`reader-a.epub` et `reader-b.epub` contiennent uniquement du texte de test rédigé pour ce dépôt. Ils évitent de modifier Directus pour tester plusieurs traductions.

- A contient deux sections XHTML, « Livre premier » et « Livre deuxième ».
- B ajoute une préface, davantage de paragraphes et un conteneur supplémentaire dans chaque section. Les index du spine et les chemins CFI ne correspondent donc plus à ceux de A.

Les tests vérifient que le lecteur ne télécharge que l’édition sélectionnée, commence au début de chaque nouvelle traduction et retrouve chaque signet indépendamment après plusieurs changements et un rechargement. Les deux éditions ont le même nom de fichier et des UUID différant uniquement par leur dernier caractère, pour détecter les collisions dues au nom ou à une troncature. Le vrai EPUB des *Confessions* est téléchargé directement depuis Directus, sans authentification, dans les tests de lecture, CORS, sommaire et typographie.
