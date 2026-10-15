/// <reference lib="webworker" />
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { readBiblePassage, type BibleReader } from '../bible-query';
import { storedBible } from './storage';
import type { WorkerRequest, StoredBible } from './types';

let sql: Promise<SqlJsStatic> | undefined;
let db: Database | undefined;
let opening: Promise<Database> | undefined;
let saved: StoredBible | undefined;
let initialized: Promise<void> | undefined;
let download: AbortController | undefined;
const engine = () => sql ??= initSqlJs({ locateFile: () => wasmUrl });
const metadata = () => saved ? { ...saved, blob: undefined } : null;
async function initialize() {
  saved = await storedBible();
}
async function openBible() {
  await (initialized ??= initialize());
  if (!saved) throw new Error('Téléchargez la Bible pour lire hors ligne.');
  if (db) return db;
  const copy = saved;
  return opening ??= (async () => {
    const SQL = await engine();
    db = new SQL.Database(new Uint8Array(await copy.blob.arrayBuffer()));
    return db;
  })().finally(() => { opening = undefined; });
}
function reader(database: Database): BibleReader {
  return { prepare(sql) {
    function all(...values: (string | number)[]) {
      const statement = database.prepare(sql);
      try {
        statement.bind(values);
        const rows = [];
        while (statement.step()) rows.push(statement.getAsObject());
        return rows;
      } finally { statement.free(); }
    }
    return { all, get: (...values) => all(...values)[0] };
  } };
}
self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  const { id, type } = data;
  try {
    await (initialized ??= initialize());
    let result: unknown;
    if (type === 'status') result = metadata();
    if (type === 'cancel') download?.abort();
    if (type === 'remove') {
      if (download) throw new Error('Annulez d’abord le téléchargement.');
      await storedBible(null);
      await opening?.catch(() => {});
      db?.close(); db = undefined; saved = undefined;
      result = null;
    }
    if (type === 'download') {
      if (download) throw new Error('Un téléchargement est déjà en cours.');
      const meta = data.metadata!;
      download = new AbortController();
      let candidate: Database | undefined;
      try {
        const external = new URL(meta.url, self.location.origin).origin !== self.location.origin;
        const res = await fetch(meta.url, {
          signal: download.signal, cache: 'no-store',
          ...(external ? { credentials: 'omit' as const, headers: { Accept: 'application/octet-stream' } } : {}),
        });
        if (!res.ok || !res.body) throw new Error('La Bible ne peut pas être téléchargée.');
        const bytes = new Uint8Array(meta.bytes);
        const stream = res.body.getReader();
        let loaded = 0;
        let reported = -1;
        for (;;) {
          const { done, value } = await stream.read();
          if (done) break;
          if (loaded + value.length > bytes.length) { await stream.cancel(); throw new Error('Taille de la Bible incorrecte.'); }
          bytes.set(value, loaded); loaded += value.length;
          const percent = Math.floor(loaded / meta.bytes * 100);
          if (percent !== reported) { reported = percent; self.postMessage({ id, progress: loaded / meta.bytes }); }
        }
        if (loaded !== meta.bytes) throw new Error('Téléchargement incomplet. Réessayez.');
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
        const hash = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
        if (hash !== meta.sha256) throw new Error('La vérification du téléchargement a échoué.');
        candidate = new (await engine()).Database(bytes);
        const check = candidate.exec('PRAGMA quick_check');
        if (check[0]?.values[0]?.[0] !== 'ok') throw new Error('Base biblique invalide.');
        // Reject future releases whose schema this reader cannot understand.
        try {
          candidate.exec('SELECT id, code, name_short FROM translations LIMIT 1');
          candidate.exec('SELECT code, order_num FROM books LIMIT 1');
          candidate.exec('SELECT translation_id, book, chapter, verse, text FROM verses LIMIT 1');
        } catch { throw new Error('Cette Bible nécessite une version plus récente du comparateur. Votre copie actuelle est conservée.'); }
        download.signal.throwIfAborted();
        const next = { ...meta, blob: new Blob([bytes]) };
        // A failed or cancelled update preserves the previous, complete database.
        await storedBible(next);
        await opening?.catch(() => {});
        db?.close(); db = candidate; candidate = undefined; saved = next;
        result = metadata();
      } finally { candidate?.close(); download = undefined; }
    }
    if (type === 'query') {
      const database = await openBible();
      const params = new URLSearchParams(data.params);
      // Codes remain stable when a later release reassigns numeric IDs.
      params.delete('t');
      for (const code of data.codes || []) {
        const rows = reader(database).prepare('SELECT id FROM translations WHERE code = ?').all(code) as {id: number}[];
        if (!rows[0]) throw new Error('Mettez à jour la copie locale pour cette traduction.');
        params.append('t', String(rows[0].id));
      }
      result = readBiblePassage(reader(database), params);
    }
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error && error.name === 'AbortError' ? 'Téléchargement annulé.' : error instanceof Error ? error.message : String(error) });
  }
};
