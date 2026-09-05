import { fetchAllFromDirectus, fileIdOf, getAssetURL } from './directus';
import { parseTags } from './catalog';
import { externalMusicUrl, musicTypes, type MusicAlbum, type MusicalArtist } from './music';

type Row = Record<string, unknown>;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const relationId = (value: unknown): string => value && typeof value === 'object'
  ? String((value as Row).id ?? '') : String(value ?? '');

/** Join only published records, even if Directus public permissions expose drafts. */
export function normalizeMusicCatalog(artistRows: Row[], albumRows: Row[], links: Row[]) {
  const artists: MusicalArtist[] = artistRows.filter(row => row.status === 'published' && text(row.slug) && text(row.name)).map(row => ({
    id: relationId(row.id), slug: text(row.slug), name: text(row.name), description: text(row.description),
    image: getAssetURL(fileIdOf(row.image), 'medium'), tags: [...new Set(parseTags(row.tags))], types: musicTypes(row.types),
    website: externalMusicUrl(row.website), youtube: externalMusicUrl(row.youtube), spotify: externalMusicUrl(row.spotify),
  }));
  const byId = new Map(artists.map(artist => [artist.id, artist]));
  const albums: MusicAlbum[] = albumRows.filter(row => row.status === 'published' && text(row.slug) && text(row.title)).map(row => {
    const credits = new Map<string, MusicAlbum['credits'][number]>();
    for (const link of links.filter(link => relationId(link.albums_id) === relationId(row.id))
      .sort((a, b) => Number(a.sort ?? Number.MAX_SAFE_INTEGER) - Number(b.sort ?? Number.MAX_SAFE_INTEGER))) {
      const artist = byId.get(relationId(link.musical_artists_id));
      if (!artist) continue;
      const existing = credits.get(artist.id);
      credits.set(artist.id, { artist, roles: [...new Set([...(existing?.roles ?? []), ...musicTypes(link.roles)])] });
    }
    return {
      id: relationId(row.id), slug: text(row.slug), title: text(row.title), description: text(row.description),
      cover: getAssetURL(fileIdOf(row.cover_image), 'medium'),
      year: row.release_year && Number.isFinite(Number(row.release_year)) ? Number(row.release_year) : null,
      tags: [...new Set(parseTags(row.tags))], credits: [...credits.values()],
      spotify: externalMusicUrl(row.spotify_url), youtube: externalMusicUrl(row.youtube_url),
    };
  });
  return { artists, albums };
}

/** Directus is queried at build time; filtering uses static JSON catalogs. */
export async function fetchMusicCatalog() {
  const [artists, albums] = await Promise.all([
    fetchAllFromDirectus<Row>('musical_artists?filter[status][_eq]=published&fields=id,status,slug,name,types,description,image,tags,website,youtube,spotify&sort=name'),
    fetchAllFromDirectus<Row>('albums?filter[status][_eq]=published&fields=id,status,slug,title,description,cover_image,release_year,tags,spotify_url,youtube_url,artists.id,artists.sort,artists.musical_artists_id,artists.roles&sort=-date_created'),
  ]);
  const links = albums.flatMap(album => Array.isArray(album.artists)
    ? album.artists.filter((link): link is Row => Boolean(link && typeof link === 'object'))
      .map(link => ({ ...link, albums_id: album.id })) : []);
  return normalizeMusicCatalog(artists, albums, links);
}
