import { parseTags, searchHaystack } from './catalog';
import { escapeHtml } from './catalog-ui';

export const MUSIC_TYPES = [
  { key: 'composer', label: 'Compositeur' },
  { key: 'conductor', label: 'Chef d’orchestre' },
  { key: 'orchestra', label: 'Orchestre' },
  { key: 'choir', label: 'Chœur' },
  { key: 'ensemble', label: 'Ensemble musical' },
  { key: 'singer', label: 'Chanteur' },
  { key: 'instrumentalist', label: 'Instrumentiste' },
  { key: 'religious_community', label: 'Communauté religieuse' },
  { key: 'arranger', label: 'Arrangeur' },
  { key: 'performer', label: 'Interprète' },
  { key: 'other', label: 'Autre' },
] as const;

export function musicTypes(value: unknown): string[] {
  return [...new Set(parseTags(value).map(type => type === 'compositor' ? 'composer' : type))];
}

export function musicTypeLabel(key: string): string {
  return MUSIC_TYPES.find(type => type.key === key)?.label ?? key;
}

export function musicTypeLabels(types: string[]): string {
  return new Intl.ListFormat('fr', { style: 'long', type: 'conjunction' }).format(types.map(musicTypeLabel));
}

export function externalMusicUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function musicPlainText(markdown: string): string {
  return markdown.replace(/<[^>]*>/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();
}

export function musicExcerpt(markdown: string, limit = 180): string {
  const text = musicPlainText(markdown.trim().split(/\r?\n\s*\r?\n/)[0] ?? '');
  return text.length > limit ? `${text.slice(0, limit).replace(/\s+\S*$/, '')}…` : text;
}

export type MusicalArtist = {
  id: string; slug: string; name: string; description: string; image: string | null;
  tags: string[]; types: string[]; website: string | null; youtube: string | null; spotify: string | null;
};
export type MusicCredit = { artist: MusicalArtist; roles: string[] };
export type MusicAlbum = {
  id: string; slug: string; title: string; description: string; cover: string | null;
  year: number | null; tags: string[]; credits: MusicCredit[]; spotify: string | null; youtube: string | null;
};
export type MusicItem = {
  slug: string; href: string; title: string; kind: 'album' | 'artist'; image: string | null;
  kicker: string; subtitle: string; tags: string[]; types: string[]; artists: string[]; haystack: string;
};

export function artistMusicItem(artist: MusicalArtist): MusicItem {
  return {
    slug: artist.slug, href: `/musique/artistes/${encodeURIComponent(artist.slug)}`, title: artist.name,
    kind: 'artist', image: artist.image, kicker: musicTypeLabels(artist.types),
    subtitle: musicExcerpt(artist.description), tags: artist.tags, types: artist.types, artists: [],
    haystack: searchHaystack([artist.name, musicPlainText(artist.description), ...artist.tags, musicTypeLabels(artist.types)]),
  };
}

export function albumMusicItem(album: MusicAlbum, roles?: string[]): MusicItem {
  return {
    slug: album.slug, href: `/musique/albums/${encodeURIComponent(album.slug)}`, title: album.title,
    kind: 'album', image: album.cover, kicker: roles?.length ? musicTypeLabels(roles) : album.year ? String(album.year) : 'Album',
    subtitle: album.credits.map(credit => credit.artist.name).join(' · '), tags: album.tags, types: [],
    artists: album.credits.map(credit => credit.artist.slug),
    haystack: searchHaystack([album.title, musicPlainText(album.description), album.year ? String(album.year) : '', ...album.tags,
      ...album.credits.map(credit => `${credit.artist.name} ${musicTypeLabels(credit.roles)}`)]),
  };
}

/** One escaped card template for prerendered pages and browser filtering. */
export function musicCardHtml(item: MusicItem, eager = false): string {
  const e = escapeHtml;
  const image = item.image
    ? `<img src="${e(item.image)}" alt="${e(item.kind === 'album' ? `Pochette de ${item.title}` : item.title)}" width="600" height="600" loading="${eager ? 'eager' : 'lazy'}" decoding="async" />`
    : '<span class="music-image-empty"><img src="/fleur-de-lys.svg" alt="" width="48" height="48" /></span>';
  return `<article class="music-card music-card-${item.kind}"><a href="${e(item.href)}">
    <div class="music-card-image">${image}</div><div class="music-card-copy">
    ${item.kicker ? `<p class="card-kicker">${e(item.kicker)}</p>` : ''}
    <h2>${e(item.title)}</h2>${item.subtitle ? `<p class="music-card-subtitle">${e(item.subtitle)}</p>` : ''}
    </div></a></article>`;
}
