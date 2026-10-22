# EPUB de validation du lecteur

`reader-a.epub` et `reader-b.epub` contiennent uniquement du texte de test rédigé pour ce dépôt. Ils évitent de modifier Directus pour tester plusieurs traductions.

- A contient deux sections XHTML, « Livre premier » et « Livre deuxième ».
- B ajoute une préface, davantage de paragraphes et un conteneur supplémentaire dans chaque section. Les index du spine et les chemins CFI ne correspondent donc plus à ceux de A.

Les tests vérifient que le lecteur ne télécharge que l’édition sélectionnée, transpose le signet par titre de section, puis reprend dans cette nouvelle édition après rechargement. Le vrai EPUB des *Confessions* est également ouvert par les tests de lecture, sommaire et typographie.
