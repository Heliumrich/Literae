import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolveDbPath } from '../bible-db';
import { BIBLE_DATA_VERSION } from '../bible-translations';
import type { OfflineBible } from './types';

export function getOfflineBible(): OfflineBible {
  const bytes = readFileSync(resolveDbPath());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return { sha256, bytes: bytes.length, version: BIBLE_DATA_VERSION, url: `/scriptorium/donnees/${sha256}.db` };
}
