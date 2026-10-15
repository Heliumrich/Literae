import type { OfflineBible } from './types';

/** PWA only. Metadata and binaries use our own origin; GitHub is contacted by Node. */
export const BIBLE_RELEASE_API = '/api/bible/verses?pwa=latest';
const ASSET_PROXY = '/api/bible/verses?pwa=download&asset=';
const LEGACY_ASSETS = 'https://api.github.com/repos/Heliumrich/French-Bibles/releases/assets/';
const CACHE_KEY = 'literae-bible-release';
export type CheckedRelease = { bible: OfflineBible; checkedAt: number };

/** Migrate cached metadata from versions that downloaded directly from GitHub. */
export function releaseDownloadUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const prefix = value.startsWith(ASSET_PROXY) ? ASSET_PROXY : value.startsWith(LEGACY_ASSETS) ? LEGACY_ASSETS : null;
  if (!prefix) return null;
  const id = value.slice(prefix.length);
  return /^[1-9][0-9]*$/.test(id) ? ASSET_PROXY + id : null;
}

function releaseBible(value: unknown): OfflineBible | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<OfflineBible>;
  const url = releaseDownloadUrl(item.url);
  if (typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)
    || !Number.isSafeInteger(item.bytes) || item.bytes! <= 0
    || typeof item.version !== 'string' || !item.version.length || item.version.length > 80 || !url) return null;
  return { sha256: item.sha256, bytes: item.bytes!, version: item.version, url };
}

export function cachedRelease(): CheckedRelease | null {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    const bible = releaseBible(value?.bible);
    return bible && Number.isFinite(value.checkedAt) ? { bible, checkedAt: value.checkedAt } : null;
  } catch { return null; }
}

export async function checkBibleRelease(): Promise<CheckedRelease> {
  const response = await fetch(BIBLE_RELEASE_API, {
    credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('La vérification des mises à jour est momentanément indisponible.');
  const bible = releaseBible(await response.json());
  if (!bible) throw new Error('Cette release ne fournit pas de base vérifiable.');
  const checked = { bible, checkedAt: Date.now() };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(checked)); } catch {}
  return checked;
}
