import Database from "better-sqlite3";
import path from 'node:path';
import { resolveBibleSource } from './bible-source.mjs';

declare const __LITERAE_BIBLE_SOURCE__: ReturnType<typeof resolveBibleSource>;

// The compiled server uses the exact snapshot used to generate its comparator.
// Native Node tests/development tooling can still resolve the source directly.
const source = process.env.BIBLE_DB || typeof __LITERAE_BIBLE_SOURCE__ === 'undefined'
  ? resolveBibleSource()
  : { ...__LITERAE_BIBLE_SOURCE__, path: path.resolve(__LITERAE_BIBLE_SOURCE__.path) };
export const getBibleSource = () => source;
export const resolveDbPath = () => source.path;

export function getBibleDb() {
  const dbPath = resolveDbPath();
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  db.pragma("query_only = ON");
  return db;
}
