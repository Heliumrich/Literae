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

// Also versions verse URLs so browser caches cannot reuse data from an older DB.
export const BIBLE_DATA_VERSION = "1.1.0";

const LEGACY_TRANSLATION_CODES: Record<number, string> = {
  1: "BDT", 2: "VUL", 3: "FIL", 4: "CRA",
};

/** Persist stable codes; numeric IDs were reassigned by release 1.1.0. */
export function restoreTranslationIds(
  saved: { selectedCodes?: unknown; selectedIds?: unknown },
  translations: TranslationRecord[],
): number[] {
  const codes = Array.isArray(saved.selectedCodes) ? saved.selectedCodes
    : Array.isArray(saved.selectedIds)
      ? saved.selectedIds.map(id => LEGACY_TRANSLATION_CODES[id]) : [];
  return codes.map(code => translations.find(translation => translation.code === code)?.id)
    .filter((id): id is number => id !== undefined);
}

/**
 * Couche curatoriale temporaire.
 *
 * Ces notices restent volontairement hors de bible.db tant que son schéma et
 * ses métadonnées sont en cours d’évolution. Toute traduction inconnue reste
 * utilisable grâce au fallback de l’API.
 */
export const TRANSLATION_EDITORIAL_META: Record<string, TranslationEditorialMeta> = {
  GLA: {
    date_label: "1905",
    authors_label: "Jean-Baptiste Glaire ; Fulcran Grégoire Vigouroux",
    source_label: "Vulgate",
    language_label: "Français",
    tradition_label: "Catholique",
    notice: "",
  },
  SAC: {
    date_label: "1855",
    authors_label: "Louis-Isaac Lemaistre de Sacy",
    source_label: "Vulgate",
    language_label: "Français",
    tradition_label: "Catholique",
    notice: "",
  },
  BDT: {
    date_label: "1843",
    authors_label: "J.-J. Bourassé & P.-D. Janvier",
    source_label: "Vulgate clémentine",
    language_label: "Français",
    tradition_label: "Catholique",
    notice:
      "Traduction accompagnée de commentaires, connue dans son édition monumentale illustrée par Gustave Doré.",
  },
  VUL: {
    date_label: "1592",
    authors_label: "Saint Jérôme ; Vetus Latina",
    source_label: "Hébreu, araméen, grec ; Vetus Latina",
    language_label: "Latin",
    tradition_label: "Catholique",
    notice:
      "Édition sixto-clémentine de la Vulgate latine, promulguée sous Clément VIII en 1592. Elle repose principalement sur les traductions et révisions de saint Jérôme, avec des livres conservés de la Vetus Latina. Les sources varient selon les livres : hébreu, araméen et grec pour l’Ancien Testament ; grec et anciennes versions latines pour le Nouveau Testament. Le texte transmis a été revu pour l’édition romaine.",
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
    ...(row.code === "SAC" ? { name_short: "Bible de Port-Royal", name_full: "Bible de Port-Royal" } : {}),
    ...(TRANSLATION_EDITORIAL_META[row.code] || EMPTY_EDITORIAL_META),
  };
}
