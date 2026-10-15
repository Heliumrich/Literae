import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const PAGE = '/scriptorium/comparateur';
const LATEST = 'https://api.github.com/repos/Heliumrich/French-Bibles/releases/latest';
const ASSET = 'https://api.github.com/repos/Heliumrich/French-Bibles/releases/assets/421';
const original = readFileSync('data/bible.db');
const originalHash = createHash('sha256').update(original).digest('hex');
let directory: string;
let updated: Buffer;
let updatedHash: string;

test.beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'literae-pwa-test-'));
  const path = join(directory, 'bible.db');
  copyFileSync('data/bible.db', path);
  const db = new Database(path);
  try {
    // Exercise stable translation codes against a real database with new IDs.
    db.pragma('foreign_keys = OFF');
    db.exec('UPDATE translations SET id = id + 100; UPDATE verses SET translation_id = translation_id + 100;');
  } finally { db.close(); }
  updated = readFileSync(path);
  updatedHash = createHash('sha256').update(updated).digest('hex');
});
test.afterAll(() => rmSync(directory, { recursive: true, force: true }));

async function installed(context: BrowserContext) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => !new URL(location.href).searchParams.has('test-browser') });
  });
}
async function baseline(page: Page) {
  await page.goto(PAGE);
  await page.getByText('Emporter le comparateur', { exact: true }).click();
  await page.getByRole('button', { name: 'Télécharger la Bible', exact: true }).click();
  await expect(page.locator('.offline-body [role="status"]')).toHaveText('La Bible et le lecteur sont disponibles hors ligne sur cet appareil.', { timeout: 60000 });
}
async function github(context: BrowserContext, same = false) {
  const calls = { metadata: 0, downloads: 0 };
  await context.route(LATEST, route => {
    calls.metadata++;
    return route.fulfill({
      contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
      json: { tag_name: '2.1.1', draft: false, prerelease: false, body: 'Changelog volontairement ignoré', assets: [{
        id: 421, name: 'bible.db', size: same ? original.length : updated.length,
        digest: `sha256:${same ? originalHash : updatedHash}`,
      }] },
    });
  });
  await context.route(ASSET, async route => {
    calls.downloads++;
    expect(route.request().headers().accept).toBe('application/octet-stream');
    await route.fulfill({ contentType: 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' }, body: same ? original : updated });
  });
  return calls;
}

async function resume(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    // Restore the browser's native visibility getter.
    delete (document as unknown as { visibilityState?: string }).visibilityState;
  });
}

test('la release est vérifiée à l’ouverture et au retour au premier plan, avec rappel après report', async ({ page, context }) => {
  const calls = await github(context);
  await baseline(page);
  expect(calls.metadata).toBe(0); // The ordinary website never queries GitHub.
  await installed(context);
  await page.reload();
  const notice = page.getByRole('status', { name: 'Mise à jour de la Bible' });
  await expect(notice).toContainText('Version 2.1.1');
  await expect(notice).toContainText((updated.length / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Mo');
  expect(calls.downloads).toBe(0);
  expect(calls.metadata).toBe(1);
  for (const viewport of [{width:390,height:844}, {width:844,height:390}]) {
    await page.setViewportSize(viewport);
    const box = await notice.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  }
  await notice.getByRole('button', {name:'Plus tard',exact:true}).click();
  await expect(notice).toHaveCount(0);
  await page.getByText('Bible hors ligne',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Mettre à jour la Bible',exact:true})).toBeVisible();
  await page.getByText('Bible hors ligne',{exact:true}).click();
  await resume(page);
  await expect.poll(() => calls.metadata).toBe(2);
  await expect(notice).toBeVisible();
  await notice.getByRole('button', {name:'Plus tard',exact:true}).click();
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(PAGE);
  await expect(reopened.getByRole('status',{name:'Mise à jour de la Bible'})).toBeVisible();
  await expect.poll(() => calls.metadata).toBe(3);
  expect(calls.downloads).toBe(0);
});

test('la mise à jour GitHub conserve les choix de traduction malgré de nouveaux identifiants', async ({ page, context }) => {
  const calls = await github(context);
  await baseline(page);
  await installed(context);
  await page.reload();
  const notice = page.getByRole('status',{name:'Mise à jour de la Bible'});
  await notice.getByRole('button',{name:'Mettre à jour la Bible',exact:true}).click();
  await expect(page.locator('.offline-body [role="status"]')).toHaveText('La Bible et le lecteur sont disponibles hors ligne sur cet appareil.',{timeout:60000});
  await expect(notice).toHaveCount(0);
  await expect(page.locator('.offline-body')).toContainText('Version locale : 2.1.1');
  expect(calls.downloads).toBe(1);
  let serverReads = 0;
  await context.route('**/api/bible/verses?**', route => { serverReads++; return route.continue(); });
  const website = await context.newPage();
  await website.goto(PAGE + '?test-browser');
  await expect(website.locator('.verse p').first()).toContainText('Dieu');
  await expect(website.locator('.site-header')).toBeVisible();
  expect(serverReads).toBe(1);
  await website.close();
  await context.setOffline(true);
  await page.reload();
  await page.locator('#cmp-ref').fill('Genèse 1');
  await page.getByRole('button',{name:'Charger ce passage',exact:true}).click();
  await expect(page.locator('.translation-page').first().locator('.verse')).toHaveCount(31);
  await page.locator('#cmp-tr-0').selectOption('5');
  await expect(page.locator('.translation-code').first()).toContainText('VUL');
  await expect(page.locator('.verse p').first()).toContainText('In principio');
});

test('le hash fait foi : une autre étiquette de release ne force pas de téléchargement', async ({ page, context }) => {
  const calls = await github(context, true);
  await baseline(page);
  await installed(context);
  await page.reload();
  await expect.poll(() => calls.metadata).toBe(1);
  await page.getByText('Bible hors ligne',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Vérifier les mises à jour de la Bible',exact:true})).toBeEnabled();
  await expect(page.getByRole('status',{name:'Mise à jour de la Bible'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Mettre à jour la Bible',exact:true})).toHaveCount(0);
  expect(calls.downloads).toBe(0);
});

test('le mode installé est compact et ses polices fonctionnent après réouverture hors ligne', async ({ page, context }) => {
  await github(context, true);
  await context.route('**/*', route => route.fallback()); // Disable the HTTP cache.
  await baseline(page);
  await installed(context);
  await page.reload();
  await expect(page.locator('.comparator-app-header')).toBeVisible();
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('.site-footer')).toBeHidden();
  await expect(page.locator('.page-intro')).toBeHidden();
  await expect(page.locator('.comparator-app-footer')).toHaveText('Literae · Tolle, lege.');
  expect(await page.locator('.comparator-app-header a, .comparator-app-footer a').count()).toBe(0);
  await context.setOffline(true);
  await page.close();
  const offline = await context.newPage();
  await offline.goto(PAGE);
  await expect(offline.locator('.verse p').first()).toContainText('Dieu');
  const fonts = await offline.evaluate(async () => {
    const families = ['Source Serif 4', 'Cormorant Garamond', 'Source Sans 3', 'Cinzel'];
    return Promise.all(families.map(async family => {
      const faces = await document.fonts.load(`16px "${family}"`, 'Évangile');
      return {family, loaded: faces.length > 0 && faces.every(face => face.status === 'loaded')};
    }));
  });
  expect(fonts.every(font => font.loaded)).toBe(true);
  const cached = await offline.evaluate(async () => {
    const key = (await caches.keys()).find(name => name.startsWith('literae-comparator-'))!;
    return (await (await caches.open(key)).keys()).map(request => new URL(request.url).pathname);
  });
  for (const file of readdirSync('public/fonts').filter(file => file.endsWith('.woff2'))) expect(cached).toContain('/fonts/' + file);
  for (const viewport of [{width:390,height:844},{width:844,height:390}]) {
    await offline.setViewportSize(viewport);
    expect(await offline.locator('.comparator-app-header').evaluate(element=>element.getBoundingClientRect().height)).toBeLessThan(60);
    expect(await offline.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
});

test('le site classique garde son header, son introduction et ses liens, sans contrôle GitHub', async ({ page, context }) => {
  const calls = await github(context);
  for (const viewport of [{width:1280,height:900},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await page.goto(PAGE);
    await expect(page.locator('.site-header')).toBeVisible();
    await expect(page.locator('.site-footer')).toBeVisible();
    await expect(page.locator('.page-intro h1')).toHaveText('Le comparateur');
    await expect(page.locator('.comparator-app-header')).toBeHidden();
    await expect(page.locator('.comparator-app-footer')).toBeHidden();
    await expect(page.getByRole('link',{name:'À propos & colophon'})).toBeVisible();
  }
  expect(calls.metadata).toBe(0);
  expect(calls.downloads).toBe(0);
});

test('actualiser l’interface recharge les onglets et conserve la Bible sans transfert', async ({ page, context }) => {
  const calls = await github(context, true);
  await baseline(page);
  await installed(context);
  await page.reload();
  await expect(page.locator('.verse p').first()).toContainText('Dieu');
  const other = await context.newPage();
  await other.goto(PAGE);
  await expect(other.locator('.verse p').first()).toContainText('Dieu');
  const workerPath = 'dist/client/scriptorium/sw.js';
  const originalWorker = readFileSync(workerPath,'utf8');
  try {
    writeFileSync(workerPath, originalWorker.replace(/literae-comparator-[a-f0-9]+/,`literae-comparator-test-${Date.now()}`));
    await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration!.update();});
    const button=page.getByRole('button',{name:'Actualiser l’application',exact:true});
    await expect(button).toBeVisible({timeout:30000});
    await Promise.all([page.waitForEvent('load'),other.waitForEvent('load'),button.click()]);
    await expect(page.locator('.verse p').first()).toContainText('Dieu');
    expect(calls.downloads).toBe(0);
    await context.setOffline(true);
    await other.locator('#cmp-ref').fill('Genèse 2');
    await other.getByRole('button',{name:'Charger ce passage',exact:true}).click();
    await expect(other.locator('.translation-page').first().locator('.verse')).toHaveCount(25);
  } finally {writeFileSync(workerPath,originalWorker);}
});
