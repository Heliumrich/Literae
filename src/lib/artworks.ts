import { normalizeText } from "./catalog";

/** Stable round-robin: keep every item, including the longest artist queues. */
export function alternateArtists<T>(items: T[], artistKey: (item: NoInfer<T>) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = artistKey(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  const result: T[] = [];
  let active = [...groups.values()];
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
