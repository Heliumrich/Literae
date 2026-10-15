import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import { resolveDbPath } from '../../../lib/bible-db';
import { getOfflineBible } from '../../../lib/offline/bible-build';

export const prerender = true;
export const getStaticPaths: GetStaticPaths = () => [{ params: { hash: getOfflineBible().sha256 } }];
export const GET: APIRoute = () => new Response(new Uint8Array(readFileSync(resolveDbPath())), {
  headers: { 'Content-Type': 'application/vnd.sqlite3' },
});
