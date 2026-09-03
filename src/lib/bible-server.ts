import { getBibleDb } from "./bible-db";
import {
  enrichTranslation,
  type BibleTranslation,
  type TranslationRecord,
} from "./bible-translations";

/** Lecture serveur utilisée au build de la page statique du comparateur. */
export function getBibleTranslations(): BibleTranslation[] {
  const db = getBibleDb();
  try {
    const rows = db
      .prepare(
        `SELECT id, code, name_short, name_full
         FROM translations
         ORDER BY code`,
      )
      .all() as TranslationRecord[];

    return rows.map(enrichTranslation);
  } finally {
    db.close();
  }
}
