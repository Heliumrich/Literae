import { execFile as execFileCallback, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';

const execFile = promisify(execFileCallback);
const repository = 'https://github.com/Heliumrich/French-Bibles.git';

async function hashBible(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

/** Fetch the single Bible source used by the website and the PWA export. */
async function syncBible() {
  const root = fileURLToPath(new URL('../', import.meta.url));

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
      await git('remote', 'add', 'origin', repository);
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

    // Git already identifies the content: reuse an unchanged file without rescanning it.
    let previous;
    try { previous = JSON.parse(await readFile(path.join(directory, 'current.json'), 'utf8')); }
    catch { /* First sync, or recover from damaged metadata. */ }
    let sha256;
    if (previous?.blob === blob && /^[a-f0-9]{64}$/.test(previous.sha256)) {
      const file = path.join(directory, previous.sha256 + '.db');
      try { await access(file); sha256 = previous.sha256; }
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
      sha256 = await hashBible(temporary);
      // A filename identifies immutable bytes. Older running servers keep their copy.
      const target = path.join(directory, sha256 + '.db');
      await rename(temporary, target);
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

try { await syncBible(); }
catch (error) {
  console.error(`Synchronisation Bible impossible : ${error.message}`);
  console.error('La copie précédente est conservée. Le build est arrêté.');
  process.exitCode = 1;
}
