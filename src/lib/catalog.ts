export const PAGE_SIZE = 40;

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tagLabel(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    const raw = row.name ?? row.tag ?? row.value ?? row.label ?? row.slug;
    return raw != null ? String(raw).trim() : "";
  }
  return "";
}

export function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(tagLabel).filter(Boolean);
  if (typeof value === "string")
    return value.split(",").map((t) => t.trim()).filter(Boolean);
  const single = tagLabel(value);
  return single ? [single] : [];
}

export function searchHaystack(parts: Array<string | null | undefined>) {
  return normalizeText(parts.filter(Boolean).join(" "));
}

export function matchesQuery(haystack: string, query: string) {
  const tokens = normalizeText(query).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((token) => haystack.includes(token));
}

export function jsonItems(items: unknown) {
  return new Response(JSON.stringify({ items }), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
