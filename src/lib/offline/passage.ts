import { offlineQuery, offlineStatus } from './client';
import { isInstalledComparator } from './display-mode';
import type { readBiblePassage } from '../bible-query';

export class OfflineBibleRequiredError extends Error {
  constructor() {
    super('Téléchargez d’abord la Bible depuis « Emporter le comparateur » pour lire hors ligne.');
  }
}

async function readLocalPassage(params: URLSearchParams, codes: string[]) {
  const saved = await offlineStatus().catch(() => null);
  return saved ? offlineQuery(params, codes) : null;
}

/** Installed app: prefer its copy. Browser: prefer the server, use its copy offline. */
export async function readComparatorPassage(params: URLSearchParams, codes: string[]): Promise<ReturnType<typeof readBiblePassage>> {
  if (isInstalledComparator() || !navigator.onLine) {
    const local = await readLocalPassage(params, codes);
    if (local) return local;
    if (!navigator.onLine) throw new OfflineBibleRequiredError();
  }

  try {
    const url = `/api/bible/verses?${params}`;
    const response = await fetch(url);
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1000);
      throw new Error(`Passage indisponible (HTTP ${response.status}, ${url}) : ${detail}`);
    }
    return await response.json();
  } catch (error) {
    // navigator.onLine can stay true when Internet access is lost or blocked.
    const local = await readLocalPassage(params, codes);
    if (local) return local;
    if (error instanceof TypeError) throw new OfflineBibleRequiredError();
    throw error;
  }
}
