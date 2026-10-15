import type { OfflineBible } from './types';

/** PWA-only: public GitHub release metadata, never a database download. */
export const BIBLE_RELEASE_API = 'https://api.github.com/repos/Heliumrich/French-Bibles/releases/latest';
const ASSET_API = 'https://api.github.com/repos/Heliumrich/French-Bibles/releases/assets/';
const CACHE_KEY = 'literae-bible-release';
export type CheckedRelease = { bible: OfflineBible; checkedAt: number };

export function isReleaseBible(value: unknown): value is OfflineBible {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<OfflineBible>;
  return typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256)
    && Number.isSafeInteger(item.bytes) && item.bytes! > 0
    && typeof item.version === 'string' && item.version.length > 0 && item.version.length <= 80
    && typeof item.url === 'string' && item.url.startsWith(ASSET_API) && /^[0-9]+$/.test(item.url.slice(ASSET_API.length));
}

export function cachedRelease(): CheckedRelease | null {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return isReleaseBible(value?.bible) && Number.isFinite(value.checkedAt) ? value : null;
  } catch { return null; }
}

export async function checkBibleRelease(): Promise<CheckedRelease> {
  const response = await fetch(BIBLE_RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json' },
    credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('La vérification des mises à jour est momentanément indisponible.');
  const release = await response.json();
  if (release.draft || release.prerelease || typeof release.tag_name !== 'string' || !Array.isArray(release.assets)) {
    throw new Error('La release biblique est invalide.');
  }
  const asset = release.assets.find((item: {name?: string}) => item.name === 'bible.db');
  const bible = {
    version: release.tag_name.replace(/^v(?=\d)/, ''),
    sha256: typeof asset?.digest === 'string' ? asset.digest.replace(/^sha256:/, '') : '',
    bytes: asset?.size,
    // The GitHub asset API supports CORS and octet-stream downloads. The
    // github.com browser_download_url does not support cross-origin fetch.
    url: `${ASSET_API}${asset?.id}`,
  };
  if (!isReleaseBible(bible)) throw new Error('Cette release ne fournit pas de base vérifiable.');
  const checked = { bible, checkedAt: Date.now() };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(checked)); } catch {}
  return checked;
}
