import type { APIRoute } from 'astro';
import { fetchMusicCatalog } from '../../lib/music-server';
import { artistMusicItem } from '../../lib/music';
import { jsonItems } from '../../lib/catalog';
export const prerender = true;
export const GET: APIRoute = async () => {
  const { artists } = await fetchMusicCatalog();
  return jsonItems(artists.map(artistMusicItem));
};
