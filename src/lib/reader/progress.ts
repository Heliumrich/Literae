export type ReadingProgress = {
  edition: string; cfi: string; sectionIndex: number; sectionCount: number;
  sectionLabel: string; sectionFraction: number; updated: number;
};
export const progressKey = (bookId: string) => `literae-book-progress-v1:${bookId}`;
export function parseProgress(value: unknown): ReadingProgress | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as ReadingProgress;
  if (typeof p.edition !== 'string' || typeof p.cfi !== 'string' || !p.cfi.startsWith('epubcfi(')
    || !Number.isInteger(p.sectionIndex) || !Number.isInteger(p.sectionCount) || p.sectionCount < 1
    || p.sectionIndex < 0 || p.sectionIndex >= p.sectionCount || !Number.isFinite(p.sectionFraction)) return null;
  return { ...p, sectionLabel: typeof p.sectionLabel === 'string' ? p.sectionLabel : '',
    sectionFraction: Math.max(0, Math.min(.999, p.sectionFraction)) };
}

/** CFIs belong to an edition. Map the shared bookmark by chapter, then proportion. */
export function correspondingSection(progress: ReadingProgress, sections: { index: number; label: string }[]): number {
  const normalize = (s: string) => s.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const label = normalize(progress.sectionLabel);
  const match = label && sections.find(section => normalize(section.label) === label);
  if (match) return match.index;
  return sections[Math.min(sections.length - 1, Math.round(progress.sectionIndex / Math.max(1, progress.sectionCount - 1) * (sections.length - 1)))]?.index ?? 0;
}
