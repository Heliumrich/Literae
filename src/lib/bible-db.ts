import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

function resolveDbPath() {
  const candidates = [
    process.env.BIBLE_DB,
    path.resolve(process.cwd(), "data/bible.db"),
    path.resolve(process.cwd(), "bible.db"),
    "/var/www/scriptorium/data/bible.db",
  ].filter(Boolean) as string[];

  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }

  throw new Error(
    `bible.db introuvable (cwd=${process.cwd()}, essayé: ${candidates.join(", ")})`,
  );
}

export function getBibleDb() {
  const dbPath = resolveDbPath();
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  db.pragma("query_only = ON");
  return db;
}
