import type { APIRoute } from "astro";
import { fetchArtistsList, getAssetURL, fileIdOf } from "../lib/directus";
import { parseTags, searchHaystack, jsonItems } from "../lib/catalog";
import { parsePersonTypes } from "../lib/people";

export const prerender = true;

export const GET: APIRoute = async () => {
  const artists = await fetchArtistsList();

  const items = artists.map((artist) => ({
    slug: artist.slug,
    href: `/personalites/${artist.slug}`,
    title: artist.name,
    subtitle: artist.short_description || null,
    thumb: getAssetURL(fileIdOf(artist.photo), "thumbnail"),
    tags: parseTags(artist.tags),
    types: parsePersonTypes(artist.type),
    haystack: searchHaystack([
      artist.name,
      artist.short_description,
      artist.type,
    ]),
  }));

  return jsonItems(items);
};
