export type ReadingProgress = {
  cfi: string; updated: number;
};
/** Directus file UUIDs identify editions regardless of their name, URL or book. */
export const progressKey = (fileId: string) => `literae-epub-progress-v2:${fileId}`;
export const lastEditionKey = (bookId: string) => `literae-reader-edition-v1:${bookId}`;
export function parseProgress(value: unknown): ReadingProgress | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as ReadingProgress;
  if (typeof p.cfi !== 'string' || !p.cfi.startsWith('epubcfi(') || !Number.isFinite(p.updated)) return null;
  return { cfi: p.cfi, updated: p.updated };
}

/** Preserve the previous bookmark only for the file that actually owned it. */
export function legacyProgressForFile(value: unknown, fileId: string): ReadingProgress | null {
  if (!value || typeof value !== 'object') return null;
  const edition = (value as { edition?: unknown }).edition;
  if (typeof edition !== 'string') return null;
  try {
    const path = new URL(edition, 'https://literae.ch').pathname;
    const previousId = path.match(/\/fichiers\/([0-9a-f-]{36})-[0-9a-f]+\.epub$/i)?.[1];
    return previousId === fileId ? parseProgress(value) : null;
  } catch { return null; }
}
