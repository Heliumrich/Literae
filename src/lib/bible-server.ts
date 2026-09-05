import { getBibleDb } from "./bible-db";
import type { BibleNavigationBook } from "./bible-navigation";
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

/** Compact navigation metadata embedded in the static comparator at build time. */
export function getBibleNavigationBooks(): BibleNavigationBook[] {
  const db = getBibleDb();
  try {
    const rows = db.prepare(`
      SELECT b.code, v.chapter, MAX(v.verse) AS last_verse
      FROM books b JOIN verses v ON v.book = b.code
      GROUP BY b.code, b.order_num, v.chapter
      ORDER BY b.order_num, v.chapter
    `).all() as Array<{ code: string; chapter: number; last_verse: number }>;
    const books = new Map<string, BibleNavigationBook>();
    for (const row of rows) {
      let book = books.get(row.code);
      if (!book) {
        book = { code: row.code, chapters: [] };
        books.set(row.code, book);
      }
      book.chapters[row.chapter - 1] = row.last_verse;
    }
    return [...books.values()];
  } finally {
    db.close();
  }
}
