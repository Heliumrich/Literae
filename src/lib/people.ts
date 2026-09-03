export const PERSON_TYPES = [
  { key: "artist", labels: ["artist", "artiste"], fr: "Artiste" },
  { key: "saint", labels: ["saint"], fr: "Saint" },
  { key: "monarch", labels: ["monarch", "monarque"], fr: "Monarque" },
  { key: "writer", labels: ["writer", "ecrivain", "écrivain"], fr: "Écrivain" },
] as const;

export type PersonTypeKey = (typeof PERSON_TYPES)[number]["key"];

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizePersonType(value: string): PersonTypeKey | null {
  const raw = fold(value);
  const found = PERSON_TYPES.find((type) => {
    const labels: readonly string[] = type.labels;
    return labels.includes(raw) || fold(type.fr) === raw;
  });
  return found?.key ?? null;
}

export function parsePersonTypes(value: unknown): PersonTypeKey[] {
  const parts = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,|]/)
      : [];
  const keys = parts
    .map((part) => normalizePersonType(String(part)))
    .filter((key): key is PersonTypeKey => Boolean(key));
  return [...new Set(keys)];
}

export function personTypeLabel(key: PersonTypeKey) {
  return PERSON_TYPES.find((t) => t.key === key)?.fr || key;
}

export function formatPersonRoles(keys: PersonTypeKey[]) {
  const labels = keys.map(personTypeLabel);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} et ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} et ${labels.at(-1)}`;
}
