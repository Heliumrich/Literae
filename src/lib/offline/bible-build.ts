import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getBibleSource } from '../bible-db';
import type { OfflineBible } from './types';

export function getOfflineBible(): OfflineBible {
  const source = getBibleSource();
  const bytes = readFileSync(source.path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const version = source.sha256 === sha256 ? source.version : `SHA-256 ${sha256.slice(0, 12)}`;
  return { sha256, bytes: bytes.length, version, url: `/scriptorium/donnees/${sha256}.db` };
}
