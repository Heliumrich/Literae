import type { Book, Contents, Location, NavItem, Rendition } from 'epubjs';
import type Section from 'epubjs/types/section';
import type { BookEdition } from '../books';
import { PALETTES, SETTINGS_KEY, parseSettings, readerCss } from './preferences';
import { correspondingSection, parseProgress, progressKey, type ReadingProgress } from './progress';

type SectionView = { index: number; element: HTMLElement; displayed: boolean; contents?: Contents };
// EPUB.js exposes these at runtime but omits them from its declaration files.
type ContinuousRendition = Rendition & { manager: { container: HTMLElement; views: { all(): SectionView[] }; q: Rendition['q'] } };
type Chapter = { href: string; label: string; depth: number };

function readLocal(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function writeLocal(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
function flattenToc(items: NavItem[], depth = 0): Chapter[] {
  return items.flatMap(item => [{ href: item.href, label: item.label.trim(), depth }, ...flattenToc(item.subitems || [], depth + 1)]);
}
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

async function initReader(root: HTMLElement) {
  const el = <T extends HTMLElement>(name: string) => root.querySelector<T>(`[data-reader="${name}"]`)!;
  const viewport = el<HTMLDivElement>('viewport');
  const selectEdition = el<HTMLSelectElement>('edition');
  const toc = el<HTMLSelectElement>('toc');
  const previous = el<HTMLButtonElement>('previous');
  const next = el<HTMLButtonElement>('next');
  const message = el<HTMLDivElement>('message');
  const error = el<HTMLParagraphElement>('error');
  const progressLabel = el<HTMLParagraphElement>('progress');
  const editions: BookEdition[] = JSON.parse(root.dataset.editions || '[]');
  const key = progressKey(root.dataset.bookId!);
  let settings = parseSettings(readLocal(SETTINGS_KEY));
  let bookmark = parseProgress(readLocal(key));
  let book: Book | undefined;
  let rendition: ContinuousRendition | undefined;
  let sections: Section[] = [];
  let chapters: Chapter[] = [];
  let selected = editions.find(edition => edition.url === bookmark?.edition) || editions[0];
  let epoch = 0;
  let controller: AbortController | undefined;
  let openingTask: Promise<void> = Promise.resolve();
  let canSave = false;
  let settingsTimer = 0;
  let settingsEpoch = 0;
  let storageAvailable = true;
  const prefetched = new Set<number>();

  const dark = () => document.documentElement.dataset.theme === 'dark';
  function styleDocument(contents: Contents) {
    const doc = contents.document;
    let style = doc.getElementById('literae-reader-style');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'literae-reader-style';
      doc.head.appendChild(style);
    }
    style.textContent = readerCss(settings, dark(), location.origin);
    doc.documentElement.lang ||= 'fr';
  }
  function updatePalette() {
    const palette = PALETTES[settings.palette === 'auto' ? dark() ? 'night' : 'cream' : settings.palette];
    root.style.setProperty('--reader-bg', palette.bg);
    root.style.setProperty('--reader-fg', palette.fg);
  }
  function showSettings() {
    for (const name of ['font', 'size', 'margin', 'palette'] as const) el<HTMLInputElement | HTMLSelectElement>(name).value = String(settings[name]);
    el<HTMLInputElement>('justify').checked = settings.justify;
    el<HTMLOutputElement>('size-label').value = `${settings.size} px`;
    el<HTMLOutputElement>('margin-label').value = `${settings.margin} px`;
    updatePalette();
  }
  function fail() {
    error.hidden = false;
    error.querySelector('span')!.textContent = 'Le livre n’a pas pu être chargé. Vérifiez votre connexion puis réessayez.';
    message.textContent = '';
    viewport.setAttribute('aria-busy', 'false');
  }
  function sectionLabel(index: number) {
    const href = sections.find(section => section.index === index)?.href.split('#')[0];
    return chapters.find(chapter => chapter.href.split('#')[0] === href)?.label || '';
  }

  /** Keep the neighbouring XHTML parsed; EPUB.js manages nearby rendered frames. */
  function preloadNeighbours(index: number) {
    const currentBook = book;
    if (!currentBook) return;
    const nearby = new Set([index - 1, index, index + 1]);
    for (const section of sections.filter(section => nearby.has(section.index))) {
      if (prefetched.has(section.index)) continue;
      prefetched.add(section.index);
      Promise.resolve(section.load(currentBook.load.bind(currentBook))).catch(() => prefetched.delete(section.index));
    }
    const rendered = new Set(rendition?.manager.views.all().filter(view => view.displayed).map(view => view.index));
    for (const old of prefetched) {
      if (!nearby.has(old) && !rendered.has(old)) {
        sections.find(section => section.index === old)?.unload();
        prefetched.delete(old);
      }
    }
  }
  function saveLocation(location: Location) {
    if (!canSave || !location.start?.cfi || !rendition) return;
    const index = location.start.index;
    const view = rendition.manager.views.all().find(view => view.index === index && view.displayed);
    const bounds = view?.element.getBoundingClientRect();
    const top = rendition.manager.container.getBoundingClientRect().top;
    const fraction = bounds?.height ? Math.max(0, Math.min(.999, (top - bounds.top) / bounds.height)) : 0;
    bookmark = {
      edition: selected.url, cfi: location.start.cfi, sectionIndex: index, sectionCount: sections.length,
      sectionLabel: sectionLabel(index), sectionFraction: fraction, updated: Date.now(),
    };
    storageAvailable = writeLocal(key, bookmark);
    const percent = Math.min(100, Math.round((index + fraction) / Math.max(1, sections.length) * 100));
    progressLabel.textContent = `${percent} % · ${storageAvailable ? 'Position enregistrée sur cet appareil' : 'Sauvegarde indisponible dans ce navigateur'}`;
    previous.disabled = location.atStart;
    next.disabled = location.atEnd;
    const chapter = chapters.find(chapter => chapter.href.split('#')[0] === location.start.href.split('#')[0]);
    if (chapter) toc.value = chapter.href;
    preloadNeighbours(index);
  }

  async function restorePosition(progress: ReadingProgress | null, active: ContinuousRendition) {
    if (!progress) { await active.display(); return; }
    if (progress.edition === selected.url) {
      try { await active.display(progress.cfi); return; } catch { /* An edited file may invalidate its CFI. */ }
    }
    const index = correspondingSection(progress, sections.map(section => ({ index: section.index, label: sectionLabel(section.index) })));
    await active.display(sections.find(section => section.index === index)?.href);
    // Chapter labels are shared by many translations; within a chapter use its relative position.
    await nextFrame();
    const view = active.manager.views.all().find(view => view.index === index && view.displayed);
    if (view) {
      await view.contents?.document.fonts.ready;
      const bounds = view.element.getBoundingClientRect();
      const container = active.manager.container;
      container.scrollTop += bounds.top - container.getBoundingClientRect().top + bounds.height * progress.sectionFraction;
    }
  }

  function requestEdition(id: string) {
    const currentEpoch = ++epoch;
    canSave = false;
    controller?.abort();
    window.clearTimeout(settingsTimer);
    settingsEpoch++;
    // EPUB.js starts its rendition asynchronously. Finish that work before destroying
    // it, so rapid switches cannot start a rendition whose book was already released.
    openingTask = openingTask.then(async () => {
      if (currentEpoch === epoch) await openEdition(id, currentEpoch);
    });
    return openingTask;
  }

  async function openEdition(id: string, currentEpoch: number) {
    const requested = editions.find(edition => edition.id === id);
    if (!requested) return;
    controller = new AbortController();
    // A switch releases the old rendition and cancels any in-flight download.
    rendition?.q.stop();
    rendition?.manager?.q.stop();
    book?.destroy();
    book = undefined;
    rendition = undefined;
    viewport.replaceChildren();
    prefetched.clear();
    selected = requested;
    selectEdition.value = id;
    toc.disabled = true;
    previous.disabled = next.disabled = true;
    el<HTMLAnchorElement>('download').href = selected.url;
    error.hidden = true;
    message.textContent = 'Ouverture du livre…';
    viewport.setAttribute('aria-busy', 'true');
    let openingBook: Book | undefined;
    try {
      const [{ default: ePub }, response] = await Promise.all([
        import('epubjs'), fetch(selected.url, { signal: controller.signal }),
      ]);
      if (!response.ok) throw new Error(`EPUB HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      if (currentEpoch !== epoch) return;
      openingBook = ePub();
      await openingBook.open(buffer);
      await openingBook.ready;
      if (currentEpoch !== epoch) { openingBook.destroy(); return; }
      book = openingBook;
      sections = [];
      book.spine.each((section: Section) => { sections.push(section); });
      if (!sections.length) throw new Error('EPUB sans texte');
      chapters = flattenToc((await book.loaded.navigation).toc);
      if (!chapters.length) chapters = sections.map((section, index) => ({ href: section.href, label: `Section ${index + 1}`, depth: 0 }));
      toc.replaceChildren(...chapters.map(chapter => new Option(`${'　'.repeat(chapter.depth)}${chapter.label}`, chapter.href)));
      const active = book.renderTo(viewport, {
        manager: 'continuous', flow: 'scrolled', spread: 'none', width: '100%', height: viewport.clientHeight,
        allowScriptedContent: false,
      }) as ContinuousRendition;
      rendition = active;
      active.hooks.content.register((contents: Contents) => {
        if (currentEpoch !== epoch) return;
        styleDocument(contents);
        contents.on('keydown', onKeydown);
      });
      active.on('rendered', (_section: Section, view: { iframe?: HTMLIFrameElement }) => {
        if (currentEpoch === epoch && view.iframe) {
          view.iframe.title = `Texte de ${root.closest('article')?.querySelector('h1')?.textContent || 'l’ouvrage'}`;
        }
      });
      active.on('relocated', (location: Location) => { if (currentEpoch === epoch) saveLocation(location); });
      await restorePosition(bookmark, active);
      if (currentEpoch !== epoch) return;
      canSave = true;
      toc.disabled = false;
      viewport.setAttribute('aria-busy', 'false');
      message.textContent = bookmark ? 'Reprise de votre lecture.' : '';
      await active.reportLocation();
    } catch (cause) {
      if (currentEpoch !== epoch) { openingBook?.destroy(); return; }
      console.error('Ouverture EPUB impossible', cause);
      fail();
    }
  }

  async function navigate(action: () => Promise<unknown>) {
    if (!rendition || !canSave) return;
    error.hidden = true;
    message.textContent = '';
    try { await action(); } catch { fail(); }
  }
  function onKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (event.altKey || event.ctrlKey || event.metaKey || target?.closest('input,select,textarea,button,[contenteditable]')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      void navigate(() => event.key === 'ArrowRight' ? rendition!.next() : rendition!.prev());
    }
  }

  /** Preserve the visible passage when typography or the automatic theme changes. */
  function applySettings() {
    showSettings();
    writeLocal(SETTINGS_KEY, settings);
    window.clearTimeout(settingsTimer);
    const currentEpoch = ++settingsEpoch;
    const saved = bookmark;
    settingsTimer = window.setTimeout(async () => {
      const active = rendition;
      if (!active || viewport.getAttribute('aria-busy') === 'true') return;
      canSave = false;
      try {
        const views = active.manager.views.all().filter(view => view.contents);
        for (const view of views) styleDocument(view.contents!);
        await nextFrame();
        await Promise.all(views.map(view => view.contents!.document.fonts.ready));
        if (currentEpoch !== settingsEpoch || active !== rendition) return;
        active.resize(viewport.clientWidth, viewport.clientHeight);
        if (saved?.edition === selected.url) await active.display(saved.cfi);
      } catch { /* A section may disappear as the continuous reader trims its frames. */ }
      finally {
        if (currentEpoch === settingsEpoch && active === rendition) {
          canSave = true;
          void active.reportLocation();
        }
      }
    }, 160);
  }

  for (const name of ['font', 'size', 'margin', 'palette', 'justify'] as const) {
    el<HTMLInputElement | HTMLSelectElement>(name).addEventListener('input', () => {
      settings = parseSettings({ ...settings, [name]: name === 'justify' ? el<HTMLInputElement>(name).checked
        : name === 'size' || name === 'margin' ? Number(el<HTMLInputElement>(name).value) : el<HTMLSelectElement>(name).value });
      applySettings();
    });
  }
  selectEdition.addEventListener('change', () => { void requestEdition(selectEdition.value); });
  toc.addEventListener('change', () => { void navigate(() => rendition!.display(toc.value)); });
  previous.addEventListener('click', () => { void navigate(() => rendition!.prev()); });
  next.addEventListener('click', () => { void navigate(() => rendition!.next()); });
  viewport.addEventListener('keydown', onKeydown);
  el('retry').addEventListener('click', () => { void requestEdition(selected.id); });
  const themeObserver = new MutationObserver(() => { if (settings.palette === 'auto') applySettings(); });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const fullscreen = el<HTMLButtonElement>('fullscreen');
  fullscreen.hidden = !document.fullscreenEnabled;
  fullscreen.addEventListener('click', async () => {
    try { if (document.fullscreenElement === root) await document.exitFullscreen(); else await root.requestFullscreen(); } catch { /* Unavailable in some embedded browsers. */ }
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreen.textContent = document.fullscreenElement === root ? 'Quitter le plein écran' : 'Plein écran';
  });
  const resizeObserver = new ResizeObserver(() => { if (rendition && canSave) rendition.resize(viewport.clientWidth, viewport.clientHeight); });
  resizeObserver.observe(viewport);
  document.addEventListener('visibilitychange', () => { if (document.hidden && bookmark && canSave) writeLocal(key, bookmark); });
  window.addEventListener('pagehide', () => { if (bookmark) writeLocal(key, bookmark); });
  showSettings();
  await requestEdition(selected.id);
}

export function initEpubReaders() {
  document.querySelectorAll<HTMLElement>('.epub-reader').forEach(root => { void initReader(root); });
}
