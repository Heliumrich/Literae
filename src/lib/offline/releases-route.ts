import { bibleReleaseSource } from './releases-server';

/** PWA-only branch of the existing Bible API, independent from verse queries. */
export async function biblePwaResponse(url: URL, signal: AbortSignal): Promise<Response> {
  try {
    if (url.searchParams.get('pwa') === 'latest') {
      return Response.json(await bibleReleaseSource.latest(), { headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.searchParams.get('pwa') === 'download') {
      return await bibleReleaseSource.download(url.searchParams.get('asset') || '', signal);
    }
    return new Response(null, { status: 404 });
  } catch {
    return Response.json({ error: 'La Bible ne peut pas être récupérée pour le moment. Vérifiez votre connexion et réessayez.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
