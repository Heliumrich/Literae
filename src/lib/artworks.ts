import { normalizeText } from "./catalog";

const artistCollator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

/** Alphabetical artist rounds; preserve each artist's works and their own order. */
export function alternateArtists<T>(
  items: T[],
  artistKey: (item: NoInfer<T>) => string,
  artistName: (item: NoInfer<T>) => string | null | undefined,
): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = artistKey(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  const result: T[] = [];
  let active = [...groups.entries()]
    .sort(([keyA, a], [keyB, b]) =>
      artistCollator.compare(artistName(a[0]) || "Artiste inconnu", artistName(b[0]) || "Artiste inconnu") ||
      artistCollator.compare(keyA, keyB),
    )
    .map(([, works]) => works);
  for (let round = 0; active.length; round++) {
    const remaining: T[][] = [];
    for (const group of active) {
      result.push(group[round]);
      if (group.length > round + 1) remaining.push(group);
    }
    active = remaining;
  }
  return result;
}

export function artworkArtistKey(work: { artist?: { id?: string; slug?: string; name?: string } | null }) {
  return String(work.artist?.id || work.artist?.slug || work.artist?.name || "unknown");
}

export function isDoreArtwork(work: { artist?: { slug?: string; name?: string } | null }) {
  return normalizeText(work.artist?.slug || "") === "gustave dore" ||
    normalizeText(work.artist?.name || "") === "gustave dore";
}
