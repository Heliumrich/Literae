import Database from "better-sqlite3";
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveBibleSource } from './bible-source.mjs';

// better-sqlite3 reads this when its native binding is first loaded.
// Enable SQLite URI parameters so immutable=1 is actually applied.
process.env.SQLITE_USE_URI = '1';

declare const __LITERAE_BIBLE_SOURCE__: ReturnType<typeof resolveBibleSource>;

// The compiled server uses the exact snapshot used to generate its comparator.
// Native Node tests/development tooling can still resolve the source directly.
// A stale BIBLE_DB in PM2/systemd must not override a compiled build's source.
const source = typeof __LITERAE_BIBLE_SOURCE__ === 'undefined'
  ? resolveBibleSource()
  : { ...__LITERAE_BIBLE_SOURCE__, path: path.resolve(__LITERAE_BIBLE_SOURCE__.path) };
export const getBibleSource = () => source;
export const resolveDbPath = () => source.path;
let sourceLogged = false;

export function getBibleDb() {
  const uri = pathToFileURL(resolveDbPath());
  uri.searchParams.set('mode', 'ro');
  uri.searchParams.set('immutable', '1');
  // Published snapshots never change: no journal, shared-memory file or SQLite locks.
  const db = new Database(uri.href, { readonly: true, fileMustExist: true });
  db.pragma("query_only = ON");
  if (!sourceLogged) {
    console.info(`[Bible] ${source.path} (mode=ro, immutable=1)`);
    sourceLogged = true;
  }
  return db;
}
