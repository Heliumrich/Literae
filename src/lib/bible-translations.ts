export type TranslationEditorialMeta = {
  date_label: string;
  authors_label: string;
  source_label: string;
  language_label: string;
  tradition_label: string;
  notice: string;
};

export type TranslationRecord = {
  id: number;
  code: string;
  name_short: string;
  name_full: string;
};

export type BibleTranslation = TranslationRecord & TranslationEditorialMeta;

/**
 * Couche curatoriale temporaire.
 *
 * Ces notices restent volontairement hors de bible.db tant que son schéma et
 * ses métadonnées sont en cours d’évolution. Toute traduction inconnue reste
 * utilisable grâce au fallback de l’API.
 */
export const TRANSLATION_EDITORIAL_META: Record<string, TranslationEditorialMeta> = {
  BDT: {
    date_label: "1843 · éd. illustrée 1866",
    authors_label: "J.-J. Bourassé & P.-D. Janvier",
    source_label: "Vulgate clémentine",
    language_label: "Français",
    tradition_label: "Catholique",
    notice:
      "Traduction accompagnée de commentaires, connue dans son édition monumentale illustrée par Gustave Doré.",
  },
  VUL: {
    date_label: "1592",
    authors_label: "Tradition hiéronymienne",
    source_label: "Vulgate sixto-clémentine",
    language_label: "Latin",
    tradition_label: "Catholique",
    notice:
      "Édition latine promulguée sous Clément VIII, longtemps texte biblique de référence de l’Église latine.",
  },
  FIL: {
    date_label: "1899",
    authors_label: "Louis-Claude Fillion",
    source_label: "Vulgate & textes originaux",
    language_label: "Français",
    tradition_label: "Catholique",
    notice:
      "Version française de l’abbé Fillion, attentive à la Vulgate et à la tradition exégétique catholique.",
  },
  CRA: {
    date_label: "1923",
    authors_label: "Augustin Crampon",
    source_label: "Hébreu, araméen & grec",
    language_label: "Français",
    tradition_label: "Catholique",
    notice:
      "Traduction catholique réalisée à partir des langues bibliques, publiée dans son édition complète après la mort de Crampon.",
  },
};

const EMPTY_EDITORIAL_META: TranslationEditorialMeta = {
  date_label: "",
  authors_label: "",
  source_label: "",
  language_label: "",
  tradition_label: "",
  notice: "",
};

export function enrichTranslation(row: TranslationRecord): BibleTranslation {
  return {
    ...row,
    ...(TRANSLATION_EDITORIAL_META[row.code] || EMPTY_EDITORIAL_META),
  };
}
