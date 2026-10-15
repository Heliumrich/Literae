import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { createBibleReleaseSource } from '../../src/lib/offline/releases-server.ts';

// Real HTTP, redirects and streams, intentionally without any CORS headers.
// Only the upstream address is substituted; no browser fetch is mocked here.
async function fixture(t, invalid = false) {
  const bytes = Buffer.alloc(128 * 1024, 42);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const requests = [];
  let slow = false;
  const asset = {
    id: 421, name: 'bible.db', size: bytes.length, digest: 'sha256:' + digest,
    browser_download_url: invalid ? 'https://example.com/bible.db' : 'https://github.com/Heliumrich/French-Bibles/releases/download/2.1.1/bible.db',
  };
  const server = createServer((req, res) => {
    requests.push({ path: req.url, headers: req.headers });
    if (req.url.endsWith('/releases/latest')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ tag_name: '2.1.1', draft: false, prerelease: false, assets: [asset], body: 'not forwarded' }));
    } else if (req.url.endsWith('/releases/assets/421')) {
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(asset));
    } else if (req.url.endsWith('/releases/download/2.1.1/bible.db')) {
      res.writeHead(302, { Location: '/signed-storage/bible.db' }); res.end();
    } else if (req.url === '/signed-storage/bible.db') {
      res.setHeader('Content-Length', bytes.length);
      if (!slow) { res.end(bytes); return; }
      let offset = 1024;
      res.write(bytes.subarray(0, offset));
      const timer = setInterval(() => {
        res.write(bytes.subarray(offset, offset + 1024)); offset += 1024;
        if (offset >= bytes.length) { clearInterval(timer); res.end(); }
      }, 20);
      res.on('close', () => clearInterval(timer));
    } else { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const upstream = (input, options) => fetch(`http://127.0.0.1:${server.address().port}${new URL(input).pathname}`, options);
  return { source: createBibleReleaseSource(upstream), requests, bytes, digest, slow: () => { slow = true; } };
}

test('metadata is small, shares concurrent requests and names a same-origin download', async t => {
  const { source, requests, bytes, digest } = await fixture(t);
  const [one, two] = await Promise.all([source.latest(), source.latest()]);
  assert.deepEqual(one, two);
  assert.deepEqual(one, { version: '2.1.1', bytes: bytes.length, sha256: digest, url: '/api/bible/verses?pwa=download&asset=421' });
  await source.latest();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].headers.authorization, undefined);
  assert.ok(JSON.stringify(one).length < 512);
});

test('Node relays real HTTP redirects without depending on upstream CORS', async t => {
  const { source, requests, bytes } = await fixture(t);
  await source.latest();
  const response = await source.download('421', new AbortController().signal);
  assert.equal(response.headers.get('content-length'), String(bytes.length));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  assert.ok(requests.some(request => request.path === '/signed-storage/bible.db'));
  assert.equal(requests.find(request => request.path.includes('/releases/download/')).headers.accept, 'application/octet-stream');
});

test('a previously offered asset can be downloaded after a server restart', async t => {
  const { source, requests, bytes } = await fixture(t);
  const response = await source.download('421', new AbortController().signal);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  assert.ok(requests[0].path.endsWith('/releases/assets/421'));
});

test('arbitrary URLs and invalid asset identifiers are rejected', async t => {
  const { source, requests } = await fixture(t, true);
  assert.equal((await source.download('../other', new AbortController().signal)).status, 404);
  assert.equal(requests.length, 0);
  await assert.rejects(source.latest(), /vérifiable/);
  assert.equal(requests.length, 1);
});

test('cancelling a transfer aborts its upstream stream and allows another download', async t => {
  const { source, bytes, slow } = await fixture(t);
  await source.latest(); slow();
  const controller = new AbortController();
  const response = await source.download('421', controller.signal);
  controller.abort();
  await assert.rejects(response.arrayBuffer(), error => error.name === 'AbortError');
  const retry = await source.download('421', new AbortController().signal);
  assert.deepEqual(Buffer.from(await retry.arrayBuffer()), bytes);
});
