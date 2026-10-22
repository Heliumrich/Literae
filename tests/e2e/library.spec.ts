import { test, expect, devices, type Page, type Frame } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const LIBRARY = '/scriptorium/bibliotheque';
let bookPath: string;

test.beforeAll(async ({ request }) => {
  const response = await request.get(`${LIBRARY}.json`);
  const { items } = await response.json();
  expect(items.length).toBeGreaterThan(0);
  bookPath = items[0].href;
});

async function openBook(page: Page) {
  await page.goto(bookPath);
  await expect(page.locator('[data-reader="viewport"]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-reader="error"]')).toBeHidden();
  await expect(page.locator('[data-reader="toc"]')).toBeEnabled();
}
async function goToSection(page: Page, text: string) {
  const option = page.locator('[data-reader="toc"] option').filter({ hasText: new RegExp(`^${text}$`) });
  await page.locator('[data-reader="toc"]').selectOption((await option.getAttribute('value'))!);
}
async function textFrame(page: Page, heading: string): Promise<Frame> {
  let found: Frame | undefined;
  await expect.poll(async () => {
    for (const frame of page.frames().slice(1)) {
      try { if (await frame.getByRole('heading', { name: heading, exact: true }).count()) { found = frame; return true; } } catch { /* A previous section may have just been removed. */ }
    }
    return false;
  }).toBe(true);
  return found!;
}

test('navigation, nouveautés, filtres, grille/liste et tri', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#recent-books-title')).toBeVisible();
  await expect(page.locator('.recent-books .book-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Ouvrir le menu', exact: true }).click();
  const link = page.locator('#mobile-nav').getByRole('link', { name: 'Bibliothèque' });
  await expect(link).toHaveAttribute('href', `https://literae.ch${LIBRARY}`);
  await page.goto(LIBRARY);
  await expect(page).toHaveURL(new RegExp(`${LIBRARY}$`));
  await expect(page.locator('#catalog-status')).toContainText('1 ouvrage');
  await page.getByRole('button', { name: 'Liste', exact: true }).click();
  await expect(page.locator('#catalog-grid')).toHaveClass(/is-list/);
  await page.locator('#book-sort').selectOption('author');
  await expect(page).toHaveURL(/sort=author/);
  await page.getByRole('button', { name: 'Filtrer', exact: true }).click();
  await page.getByLabel('Théologie', { exact: true }).check();
  await expect(page.locator('#catalog-grid .book-card')).toHaveCount(1);
  await page.locator('#catalog-search').fill('aucun-livre');
  await expect(page.locator('#catalog-grid .book-card')).toHaveCount(0);
  await expect(page.locator('#catalog-empty')).toContainText('Aucun ouvrage');
  await page.getByRole('button', { name: 'Effacer les filtres', exact: true }).click();
  await expect(page.locator('#catalog-grid .book-card')).toHaveCount(1);
  const person = await page.request.get('/personalites/aurelius-augustinus');
  expect(await person.text()).toContain('Ouvrages de Augustin');
  expect(await person.text()).toContain(`https://literae.ch${bookPath}`);
});

test('permet de réessayer après un échec de téléchargement de l’EPUB', async ({ page }) => {
  await page.route('**/scriptorium/bibliotheque/fichiers/*.epub', route => route.abort('internetdisconnected'));
  await page.goto(bookPath);
  await expect(page.locator('[data-reader="error"]')).toBeVisible();
  await page.unroute('**/scriptorium/bibliotheque/fichiers/*.epub');
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(page.locator('[data-reader="viewport"]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-reader="error"]')).toBeHidden();
  await expect(page.locator('[data-reader="toc"]')).toBeEnabled();
});

for (const device of ['Desktop Chrome', 'Pixel 7']) {
  test.describe(`Lecture EPUB : ${device}`, () => {
    const profile = devices[device];
    test.use({ viewport: profile.viewport, userAgent: profile.userAgent, isMobile: profile.isMobile, hasTouch: profile.hasTouch, deviceScaleFactor: profile.deviceScaleFactor });

    test('lit le vrai EPUB, adapte le texte et charge les polices à la sélection', async ({ page }) => {
      const fontRequests: string[] = [];
      const errors: string[] = [];
      page.on('request', request => { if (request.url().includes('/reader-fonts/')) fontRequests.push(request.url()); });
      page.on('pageerror', error => errors.push(error.message));
      await openBook(page);
      await expect(page.locator('[data-reader="toc"] option').filter({ hasText: /^Livre / })).toHaveCount(13);
      await goToSection(page, 'Livre premier');
      const frame = await textFrame(page, 'Livre premier');
      await expect(frame.locator('body')).toContainText('notre coeur est inquiet');
      expect(fontRequests).toHaveLength(0);
      const headingFont = await frame.locator('h2').first().evaluate(node => getComputedStyle(node).fontFamily);
      await page.getByText('Réglages de lecture', { exact: false }).click();
      await page.locator('[data-reader="font"]').selectOption('literata');
      await expect.poll(() => frame.locator('p').first().evaluate(node => getComputedStyle(node).fontFamily)).toContain('Literae Literata');
      expect(fontRequests.some(url => url.includes('literata'))).toBe(true);
      expect(fontRequests.some(url => url.includes('lora') || url.includes('libre-baskerville'))).toBe(false);
      expect(await frame.locator('h2').first().evaluate(node => getComputedStyle(node).fontFamily)).toBe(headingFont);
      await page.locator('[data-reader="size"]').fill('25');
      await page.locator('[data-reader="margin"]').fill('48');
      await page.locator('[data-reader="justify"]').check();
      await page.locator('[data-reader="palette"]').selectOption('oled');
      await expect.poll(() => frame.locator('body').evaluate(node => {
        const s = getComputedStyle(node); return [s.backgroundColor, s.color, s.fontSize, s.paddingLeft];
      })).toEqual(['rgb(0, 0, 0)', 'rgb(231, 225, 215)', '25px', '48px']);
      await expect.poll(() => frame.locator('p').first().evaluate(node => getComputedStyle(node).textAlign)).toBe('justify');
      await page.locator('[data-reader="palette"]').selectOption('auto');
      await page.getByRole('button', { name: 'Activer le thème sombre', exact: true }).click();
      await expect.poll(() => frame.locator('body').evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(23, 21, 19)');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(overflow).toBe(false);
      expect(await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      if (device === 'Pixel 7') {
        await page.setViewportSize({ width: 915, height: 412 });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      }
      expect(errors).toEqual([]);
    });

    test('reprend le livre après fermeture et conserve les réglages', async ({ page, context }) => {
      await openBook(page);
      await goToSection(page, 'Livre cinquième');
      await textFrame(page, 'Livre cinquième');
      await page.getByText('Réglages de lecture', { exact: false }).click();
      await page.locator('[data-reader="size"]').fill('24');
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('literae-reader-settings-v1') || '{}').size)).toBe(24);
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('literae-book-progress-v1:a758f0c9-c999-4d8a-ae1d-42f8a7c66c92') || '{}').sectionLabel)).toBe('Livre cinquième');
      await page.close();
      const reopened = await context.newPage();
      await openBook(reopened);
      await expect(reopened.locator('[data-reader="toc"]')).toHaveValue(/livre_cinquieme/);
      await expect(reopened.locator('[data-reader="size"]')).toHaveValue('24');
      await expect(reopened.locator('[data-reader="progress"]')).toContainText('Position enregistrée');
    });

    test('charge une seule traduction puis transpose le signet vers un EPUB structuré autrement', async ({ page }) => {
      const downloads: string[] = [];
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const editions = ['a', 'b'].map(id => ({ id, label: `Traduction ${id.toUpperCase()}`, url: `/reader-test/${id}.epub`, size: 1000 }));
      await page.route(`**${bookPath}`, async route => {
        const response = await route.fetch();
        let body = await response.text();
        body = body.replace(/data-editions="[^"]*"/, `data-editions="${JSON.stringify(editions).replaceAll('"', '&quot;')}"`)
          .replace(/(<select[^>]*data-reader="edition"[^>]*>)[\s\S]*?<\/select>/,
            `$1${editions.map(e => `<option value="${e.id}">${e.label}</option>`).join('')}</select>`);
        await route.fulfill({ response, body });
      });
      await page.route('**/reader-test/*.epub', async route => {
        const id = new URL(route.request().url()).pathname.endsWith('a.epub') ? 'a' : 'b';
        downloads.push(id);
        await route.fulfill({ body: await readFile(new URL(`../fixtures/reader-${id}.epub`, import.meta.url)), contentType: 'application/epub+zip' });
      });
      await openBook(page);
      expect(downloads).toEqual(['a']);
      await goToSection(page, 'Livre deuxième');
      const frame = await textFrame(page, 'Livre deuxième');
      await expect(frame.locator('p').first()).toContainText('Édition A');
      await page.locator('[data-reader="viewport"]').hover({ position: { x: 100, y: 100 } });
      await page.mouse.wheel(0, 1200);
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('literae-book-progress-v1:a758f0c9-c999-4d8a-ae1d-42f8a7c66c92') || '{}').sectionFraction)).toBeGreaterThan(.02);
      await page.locator('[data-reader="edition"]').selectOption('b');
      await expect(page.locator('[data-reader="viewport"]')).toHaveAttribute('aria-busy', 'false');
      await expect(page.locator('[data-reader="toc"]')).toHaveValue('deuxieme.xhtml');
      const translated = await textFrame(page, 'Livre deuxième');
      await expect(translated.locator('p').first()).toContainText('Édition B');
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('literae-book-progress-v1:a758f0c9-c999-4d8a-ae1d-42f8a7c66c92') || '{}').sectionIndex)).toBe(2);
      expect(downloads).toEqual(['a', 'b']);
      await page.reload();
      await expect(page.locator('[data-reader="viewport"]')).toHaveAttribute('aria-busy', 'false');
      await expect(page.locator('[data-reader="edition"]')).toHaveValue('b');
      await expect(page.locator('[data-reader="toc"]')).toHaveValue('deuxieme.xhtml');
      await page.locator('[data-reader="edition"]').selectOption('a');
      await page.locator('[data-reader="edition"]').selectOption('b');
      await expect(page.locator('[data-reader="viewport"]')).toHaveAttribute('aria-busy', 'false');
      await expect(page.locator('[data-reader="error"]')).toBeHidden();
      expect(errors).toEqual([]);
    });
  });
}
