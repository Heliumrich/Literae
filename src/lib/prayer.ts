import { parseTags, searchHaystack } from "./catalog";

export type Prayer = {
  id?: string;
  slug: string;
  sort?: number | null;
  status?: string;
  title_latin?: string | null;
  title_french?: string | null;
  text_latin?: string | null;
  text_french?: string | null;
  description?: string | null;
  tags?: unknown;
};

export function prayerTitle(p: Prayer) {
  return p.title_french?.trim() || p.title_latin?.trim() || "Sans titre";
}

export function plainText(src: string | null | undefined) {
  return (src || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function firstSentence(src: string | null | undefined) {
  const text = plainText(src);
  if (!text) return "";
  const match = text.match(/.*?[.!?](?=\s|$)/);
  return match ? match[0].trim() : text;
}

export function prayerStanzas(src: string | null | undefined): string[][] {
  if (!src?.trim()) return [];
  return src
    .trim()
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((block) => block.length > 0);
}

export function prayerToIndex(p: Prayer) {
  const tags = parseTags(p.tags);
  return {
    slug: p.slug,
    href: `/prieres/${p.slug}`,
    title: prayerTitle(p),
    titleLatin: p.title_latin?.trim() || "",
    description: plainText(p.description),
    lead: firstSentence(p.description),
    tags,
    haystack: searchHaystack([
      p.title_french,
      p.title_latin,
      p.description,
      p.text_french,
      p.text_latin,
    ]),
  };
}

/** Markdown très léger pour le champ description Directus. */
export function renderMarkdown(src: string) {
  const escaped = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withInline = escaped
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" class="underline hover:text-fg">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return withInline
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}
