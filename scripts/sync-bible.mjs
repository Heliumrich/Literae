import { execFile as execFileCallback, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import Database from 'better-sqlite3';

const execFile = promisify(execFileCallback);
const repository = 'https://github.com/Heliumrich/French-Bibles.git';

export async function hashBible(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export function validateBible(file) {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    if (db.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('Intégrité SQLite invalide.');
    for (const query of [
      'SELECT id, code, name_short, name_full FROM translations LIMIT 1',
      'SELECT code, name_fr, testament, order_num FROM books LIMIT 1',
      'SELECT translation_id, book, chapter, verse, text FROM verses LIMIT 1',
    ]) {
      if (!db.prepare(query).get()) throw new Error('Base biblique vide ou incompatible.');
    }
  } finally { db.close(); }
}

/** Separate Git cache: never pulls into or overwrites data/bible.db. */
export async function syncBible({ root = process.cwd(), upstream = repository, override = process.env.BIBLE_DB } = {}) {
  if (override) {
    validateBible(path.resolve(root, override));
    console.log('Bible : BIBLE_DB défini, copie personnalisée conservée (synchronisation automatique désactivée).');
    return null;
  }

  const directory = path.join(root, 'data/french-bibles');
  const cache = path.join(directory, 'repository.git');
  await mkdir(directory, { recursive: true });
  // Serialize synchronizations; each compiled server pins its own snapshot.
  const lock = path.join(directory, '.sync-lock');
  await mkdir(lock).catch(() => { throw new Error('Synchronisation Bible déjà en cours (data/french-bibles/.sync-lock).'); });
  let scratch;
  const git = async (...args) => (await execFile('git', ['--git-dir', cache, ...args], {
    timeout: 180_000, maxBuffer: 2_000_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })).stdout.trim();
  try {
    try { await access(path.join(cache, 'HEAD')); }
    catch {
      await execFile('git', ['init', '--bare', cache]);
      await git('remote', 'add', 'origin', upstream);
    }
    await git('fetch', '--depth=1', 'origin', 'main');
    const commit = await git('rev-parse', 'FETCH_HEAD^{commit}');
    const blob = await git('rev-parse', `${commit}:bible.db`);
    // Tags are a small request; old 50–100 MB databases are not fetched.
    const tags = await git('ls-remote', '--tags', 'origin');
    const versions = tags.split('\n').flatMap(line => {
      const [target, ref = ''] = line.split(/\s+/);
      const match = /^refs\/tags\/v?(\d+\.\d+\.\d+)(?:\^\{\})?$/.exec(ref);
      return target === commit && match ? [match[1]] : [];
    }).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
    const version = versions[0] || `git-${commit.slice(0, 12)}`;

    // If the Git blob is unchanged, verify and reuse the existing file.
    let previous;
    try { previous = JSON.parse(await readFile(path.join(directory, 'current.json'), 'utf8')); }
    catch { /* First sync, or recover from damaged metadata. */ }
    let sha256;
    if (previous?.blob === blob && /^[a-f0-9]{64}$/.test(previous.sha256)) {
      const file = path.join(directory, previous.sha256 + '.db');
      try { if (await hashBible(file) === previous.sha256) sha256 = previous.sha256; }
      catch { /* Re-export a missing snapshot. */ }
    }
    if (!sha256) {
      scratch = await mkdtemp(path.join(directory, '.download-'));
      const temporary = path.join(scratch, 'bible.db');
      const child = spawn('git', ['--git-dir', cache, 'show', `${commit}:bible.db`], { stdio: ['ignore', 'pipe', 'pipe'] });
      const completed = new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', code => code === 0 ? resolve() : reject(new Error('Export Git de bible.db échoué.')));
      });
      child.stderr.resume();
      await Promise.all([pipeline(child.stdout, createWriteStream(temporary)), completed]);
      validateBible(temporary);
      sha256 = await hashBible(temporary);
      // A filename identifies immutable bytes. Older running servers keep their copy.
      const target = path.join(directory, sha256 + '.db');
      try {
        await access(target);
        if (await hashBible(target) !== sha256) throw new Error(`Copie existante altérée : ${target}`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await rename(temporary, target);
      }
    }
    const metadata = { version, sha256, bytes: (await stat(path.join(directory, sha256 + '.db'))).size, commit, blob };
    const pending = path.join(lock, 'current.json');
    await writeFile(pending, JSON.stringify(metadata, null, 2) + '\n');
    await rename(pending, path.join(directory, 'current.json'));
    console.log(`Bible French-Bibles : ${version} · ${(metadata.bytes / 1_000_000).toFixed(1)} Mo · SHA-256 ${sha256.slice(0, 12)}`);
    return metadata;
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (await access('.env').then(() => true, () => false)) process.loadEnvFile('.env');
  try { await syncBible(); }
  catch (error) {
    console.error(`Synchronisation Bible impossible : ${error.message}`);
    console.error('La copie précédente est conservée. Le build est arrêté.');
    process.exitCode = 1;
  }
}
