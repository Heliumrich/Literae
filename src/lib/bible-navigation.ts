/** Chapter lengths in biblical order; index 0 is chapter 1. No verse text. */
export type BibleNavigationBook = {
  code: string;
  chapters: number[];
};

export type BibleNavTarget = {
  book: string;
  chapter: number;
  verse: number | null;
};

export type BibleNavigation = {
  prev: BibleNavTarget | null;
  next: BibleNavTarget | null;
};

/** Fallback for verse APIs that do not yet return navigation destinations. */
export function getBibleNavigation(
  books: BibleNavigationBook[],
  current: { book: string; chapter: number; verse: number | null; verseEnd?: number | null },
): BibleNavigation {
  const empty = { prev: null, next: null };
  const bookIndex = books.findIndex((book) => book.code === current.book);
  const book = books[bookIndex];
  const lastVerse = book?.chapters[current.chapter - 1];
  if (!lastVerse) return empty;

  const verse = current.verse && !current.verseEnd ? current.verse : null;
  if (verse !== null && (!Number.isInteger(verse) || verse < 1 || verse > lastVerse)) return empty;

  const previousBook = books[bookIndex - 1];
  const nextBook = books[bookIndex + 1];
  const previousChapter = current.chapter > 1
    ? { book: book.code, chapter: current.chapter - 1, lastVerse: book.chapters[current.chapter - 2] }
    : previousBook
      ? { book: previousBook.code, chapter: previousBook.chapters.length, lastVerse: previousBook.chapters.at(-1)! }
      : null;
  const nextChapter = current.chapter < book.chapters.length
    ? { book: book.code, chapter: current.chapter + 1 }
    : nextBook ? { book: nextBook.code, chapter: 1 } : null;

  return {
    prev: verse !== null && verse > 1
      ? { book: book.code, chapter: current.chapter, verse: verse - 1 }
      : previousChapter
        ? { book: previousChapter.book, chapter: previousChapter.chapter, verse: verse === null ? null : previousChapter.lastVerse }
        : null,
    next: verse !== null && verse < lastVerse
      ? { book: book.code, chapter: current.chapter, verse: verse + 1 }
      : nextChapter ? { ...nextChapter, verse: verse === null ? null : 1 } : null,
  };
}
