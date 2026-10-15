import type { OfflineBible } from './types';

const REPOSITORY = 'https://api.github.com/repos/Heliumrich/French-Bibles';
const DOWNLOADS = 'https://github.com/Heliumrich/French-Bibles/releases/download/';
const CACHE_MS = 5 * 60_000;
type Asset = { id: string; bytes: number; sha256: string; download: string };

/** Server only. GitHub downloads are streamed through our origin, never buffered. */
export function createBibleReleaseSource(upstream: typeof fetch = fetch) {
  const assets = new Map<string, Asset>();
  let cached: { bible: OfflineBible; expires: number } | undefined;
  let pending: Promise<OfflineBible> | undefined;

  async function json(path: string) {
    const response = await upstream(REPOSITORY + path, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Literae-PWA' },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error('GitHub est momentanément indisponible. Réessayez plus tard.');
    return response.json();
  }

  function remember(value: Record<string, unknown>): Asset {
    const download = typeof value.browser_download_url === 'string' ? value.browser_download_url : '';
    const sha256 = typeof value.digest === 'string' ? value.digest.replace(/^sha256:/, '') : '';
    const id = String(value.id);
    const url = new URL(download || 'https://invalid.local');
    if (value.name !== 'bible.db' || !/^[1-9][0-9]*$/.test(id)
      || !Number.isSafeInteger(value.size) || Number(value.size) <= 0
      || !/^[a-f0-9]{64}$/.test(sha256)
      || !download.startsWith(DOWNLOADS) || !url.pathname.endsWith('/bible.db')
      || url.username || url.password || url.port || url.search || url.hash) {
      throw new Error('Cette release ne fournit pas de base biblique vérifiable.');
    }
    const asset = { id, bytes: Number(value.size), sha256, download };
    assets.set(id, asset);
    if (assets.size > 32) assets.delete(assets.keys().next().value!);
    return asset;
  }

  async function latest(): Promise<OfflineBible> {
    if (cached && cached.expires > Date.now()) return cached.bible;
    if (pending) return pending;
    pending = (async () => {
      const release = await json('/releases/latest');
      if (release.draft || release.prerelease || typeof release.tag_name !== 'string' || !Array.isArray(release.assets)) {
        throw new Error('La release biblique est invalide.');
      }
      const value = release.assets.find((item: { name?: string }) => item?.name === 'bible.db');
      if (!value) throw new Error('La release ne contient pas de Bible téléchargeable.');
      const asset = remember(value);
      const bible = {
        version: release.tag_name.replace(/^v(?=\d)/, ''),
        sha256: asset.sha256, bytes: asset.bytes, url: `/api/bible/verses?pwa=download&asset=${asset.id}`,
      };
      cached = { bible, expires: Date.now() + CACHE_MS };
      return bible;
    })();
    try { return await pending; } finally { pending = undefined; }
  }

  async function download(id: string, signal: AbortSignal): Promise<Response> {
    if (!/^[1-9][0-9]*$/.test(id)) return new Response(null, { status: 404 });
    // A stored update may refer to a previous release, not only today's latest.
    const asset = assets.get(id) ?? remember(await json(`/releases/assets/${id}`));
    if (asset.id !== id) throw new Error('La base demandée est introuvable.');
    const response = await upstream(asset.download, {
      headers: { Accept: 'application/octet-stream', 'Accept-Encoding': 'identity' }, signal,
    });
    if (!response.ok || !response.body) throw new Error('La Bible ne peut pas être téléchargée. Réessayez plus tard.');
    return new Response(response.body, {
      headers: {
        'Content-Type': 'application/vnd.sqlite3',
        'Content-Length': String(asset.bytes),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  return { latest, download };
}

export const bibleReleaseSource = createBibleReleaseSource();
