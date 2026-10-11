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
    authors_label: "J-B Glaire & F. G. Vigouroux",
    source_label: "Vulgate clémentine (latin)",
    language_label: "Français",
    tradition_label: "Catholique",
    notice: "Version française de la Vulgate clémentine par J.-B. Glaire. Son Nouveau Testament fut examiné à Rome et approuvé par le Saint-Siège. Édition Roger et Chernoviz de 1905, avec le travail éditorial de F. G. Vigouroux sur les introductions, notes complémentaires et appendices.",
  },
  SAC: {
    date_label: "1855 + Furne 1841",
    authors_label: "Louis-Isaac Lemaistre de Sacy",
    source_label: "Vulgate (tradition de Port-Royal)",
    language_label: "Français",
    tradition_label: "Catholique",
    notice: "Traduction catholique de la Vulgate élaborée à Port-Royal au XVIIe siècle. Les premières éditions comportaient des lectures et commentaires marqués par le jansénisme ; des rééditions ont corrigé des passages contestés et supprimé ou remplacé les anciennes notes. Ces commentaires ne sont pas repris ici. Texte de l’édition de 1855 de la Société biblique, dans la tradition révisée de Rondet (1759), complété par l’édition catholique Furne (1841) pour les deutérocanoniques.",
  },
  BDT: {
    date_label: "1843",
    authors_label: "J.-J. Bourassé & P.-D. Janvier",
    source_label: "Vulgate clémentine",
    language_label: "Français",
    tradition_label: "Catholique",
    notice: "Traduction catholique de la Vulgate par les chanoines J.-J. Bourassé et P.-D. Janvier, publiée à Tours chez Mame à partir de 1843. Elle porte l’approbation de l’archevêque de Tours et fut reprise dans la grande édition illustrée par Gustave Doré en 1866.",
  },
  VUL: {
    date_label: "1592",
    authors_label: "Saint Jérôme ; Vetus Latina",
    source_label: "Hébreu, araméen, grec ; Vetus Latina",
    language_label: "Latin",
    tradition_label: "Catholique",
    notice: "Édition sixto-clémentine de la Vulgate latine, promulguée sous Clément VIII en 1592. Elle repose principalement sur les traductions et révisions de saint Jérôme, avec des livres conservés de la Vetus Latina. Les sources varient selon les livres : hébreu, araméen et grec pour l’Ancien Testament ; grec et anciennes versions latines pour le Nouveau Testament. Le texte transmis a été revu pour l’édition romaine.",
  },
  FIL: {
    date_label: "1899",
    authors_label: "Louis-Claude Fillion",
    source_label: "Vulgate clémentine (latin)",
    language_label: "Français",
    tradition_label: "Catholique",
    notice: "Version catholique fondée sur la Vulgate latine, dont Fillion suit de très près le texte. L’hébreu, l’araméen et le grec sont consultés pour l’étude et l’explication des passages ; la Vulgate reste la base de la traduction française. Cette Bible fut préparée à l’usage des séminaires et du clergé.",
  },
  CRA: {
    date_label: "1923",
    authors_label: "Augustin Crampon",
    source_label: "Hébreu, araméen & grec",
    language_label: "Français",
    tradition_label: "Catholique",
    notice: "Traduction catholique faite directement sur les langues bibliques : hébreu et araméen pour les livres correspondants de l’Ancien Testament, grec pour les livres transmis en grec et le Nouveau Testament. La Vulgate est consultée comme témoin de comparaison. L’édition de 1923 révise l’œuvre de Crampon avec le concours de biblistes jésuites et sulpiciens.",
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
