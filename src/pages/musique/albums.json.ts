import type { APIRoute } from 'astro';
import { fetchMusicCatalog } from '../../lib/music-server';
import { albumMusicItem } from '../../lib/music';
import { jsonItems } from '../../lib/catalog';
export const prerender = true;
export const GET: APIRoute = async () => {
  const { albums } = await fetchMusicCatalog();
  return jsonItems(albums.map(album => albumMusicItem(album)));
};
