import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { syncBible } from '../../scripts/sync-bible.mjs';
import { resolveBibleSource } from '../../src/lib/bible-source.mjs';

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'literae-sync-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const upstream = path.join(directory, 'upstream');
  const root = path.join(directory, 'site');
  mkdirSync(upstream); mkdirSync(path.join(root, 'data'), { recursive: true });
  const git = (...args) => execFileSync('git', ['-C', upstream, ...args], { stdio: 'pipe' }).toString().trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Bible fixture');
  git('config', 'user.email', 'fixture@example.test');
  const database = path.join(upstream, 'bible.db');
  const db = new Database(database);
  db.exec(`
    CREATE TABLE translations (id INTEGER PRIMARY KEY, code TEXT, name_short TEXT, name_full TEXT);
    CREATE TABLE books (code TEXT, name_fr TEXT, testament TEXT, order_num INTEGER);
    CREATE TABLE verses (translation_id INTEGER, book TEXT, chapter INTEGER, verse INTEGER, text TEXT);
    INSERT INTO translations VALUES (1, 'BDT', 'Tours', 'Bible de Tours');
    INSERT INTO books VALUES ('GEN', 'Genèse', 'OT', 1);
    INSERT INTO verses VALUES (1, 'GEN', 1, 1, 'Au commencement');
  `);
  db.close();
  const publish = version => { git('add', 'bible.db'); git('commit', '--allow-empty', '-m', version); git('tag', version); };
  publish('2.1.1');
  return { root, upstream, git, database, publish, sync: () => syncBible({ root, upstream, override: '' }) };
}

test('synchronise la vraie version, réutilise le fichier inchangé et préserve les copies existantes', async t => {
  const f = fixture(t);
  for (const suffix of ['', '-wal', '-shm']) writeFileSync(path.join(f.root, 'data/bible.db' + suffix), 'installation existante');
  const first = await f.sync();
  assert.equal(first.version, '2.1.1');
  const selected = resolveBibleSource(f.root, '');
  assert.equal(selected.version, '2.1.1');
  assert.equal(selected.sha256, first.sha256);
  assert.deepEqual(readFileSync(selected.path), readFileSync(f.database));
  const mtime = statSync(selected.path).mtimeMs;
  assert.deepEqual(await f.sync(), first);
  assert.equal(statSync(selected.path).mtimeMs, mtime);

  f.publish('2.1.2'); // Same bytes under another tag: no new database file.
  assert.equal((await f.sync()).version, '2.1.2');
  assert.equal(readdirSync(path.dirname(selected.path)).filter(file => file.endsWith('.db')).length, 1);

  const db = new Database(f.database);
  db.exec("UPDATE verses SET text = 'Texte corrigé'"); db.close();
  f.publish('2.2.0');
  const next = await f.sync();
  assert.equal(next.version, '2.2.0');
  assert.notEqual(next.sha256, first.sha256);
  assert.equal(existsSync(selected.path), true, 'old running server retains its immutable snapshot');
  assert.notEqual(resolveBibleSource(f.root, '').path, selected.path);
  for (const suffix of ['', '-wal', '-shm']) assert.equal(readFileSync(path.join(f.root, 'data/bible.db' + suffix), 'utf8'), 'installation existante');
});

test('une base corrompue ou incompatible ne remplace pas la copie validée', async t => {
  const f = fixture(t);
  await f.sync();
  const manifest = path.join(f.root, 'data/french-bibles/current.json');
  const before = readFileSync(manifest, 'utf8');
  writeFileSync(f.database, 'interrupted download');
  f.publish('2.2.0');
  await assert.rejects(f.sync());
  assert.equal(readFileSync(manifest, 'utf8'), before);
  rmSync(f.database);
  const db = new Database(f.database); db.exec('CREATE TABLE unrelated (id INTEGER)'); db.close();
  f.publish('2.3.0');
  await assert.rejects(f.sync());
  assert.equal(readFileSync(manifest, 'utf8'), before);
  assert.ok(!readdirSync(path.dirname(manifest)).some(file => file.startsWith('.download-') || file === '.sync-lock'));
});

test('un échec Git conserve la copie et un commit sans tag ne prétend pas être une release', async t => {
  const f = fixture(t);
  writeFileSync(f.database, readFileSync(f.database));
  f.git('commit', '--allow-empty', '-m', 'unreleased');
  const current = await f.sync();
  assert.match(current.version, /^git-[a-f0-9]{12}$/);
  const manifest = path.join(f.root, 'data/french-bibles/current.json');
  const before = readFileSync(manifest, 'utf8');
  rmSync(f.upstream, { recursive: true, force: true });
  await assert.rejects(f.sync());
  assert.equal(readFileSync(manifest, 'utf8'), before);
});

test('BIBLE_DB conserve le choix explicite et refuse un chemin manquant', async t => {
  const f = fixture(t);
  assert.equal(await syncBible({ root: f.root, override: f.database }), null);
  assert.equal(resolveBibleSource(f.root, f.database).path, f.database);
  assert.equal(existsSync(path.join(f.root, 'data/french-bibles')), false);
  assert.throws(() => resolveBibleSource(f.root, '/missing/bible.db'), /BIBLE_DB introuvable/);
});

test('reconnaît aussi une release avec un tag annoté préfixé par v', async t => {
  const f = fixture(t);
  f.git('tag', '-d', '2.1.1');
  f.git('tag', '-a', 'v2.1.1', '-m', 'Release 2.1.1');
  assert.equal((await f.sync()).version, '2.1.1');
});
