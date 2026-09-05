import { PAGE_SIZE } from './catalog';
import { musicCardHtml, type MusicItem } from './music';
import {
  bindCatalogChrome, filterCatalog, markActiveButtons, readFilterParams, renderPager,
  selectedTags, uncheckTags, updateFilterStatus, writeFilterParams, type CatalogView,
} from './catalog-ui';

export async function initMusicCatalog() {
  const root = document.getElementById('music-catalog');
  const grid = document.getElementById('catalog-grid');
  const search = document.getElementById('catalog-search') as HTMLInputElement | null;
  const artist = document.getElementById('music-artist-filter') as HTMLSelectElement | null;
  const status = document.getElementById('catalog-status');
  const empty = document.getElementById('catalog-empty');
  const pager = document.getElementById('catalog-pager');
  if (!root || !grid || !root.dataset.json) return;

  const initial = readFilterParams(search);
  let page = initial.page;
  let mode = initial.mode;
  let view: CatalogView = initial.view;
  const params = new URLSearchParams(location.search);
  if (artist && [...artist.options].some(option => option.value === params.get('artist'))) artist.value = params.get('artist')!;
  const typeButtons = [...document.querySelectorAll<HTMLButtonElement>('.type-filter')];
  const initialTypes = (params.get('types') ?? '').split(',');
  typeButtons.forEach(button => button.setAttribute('aria-pressed', String(initialTypes.includes(button.dataset.type ?? ''))));
  let items: MusicItem[];
  try {
    const response = await fetch(root.dataset.json);
    if (!response.ok) throw new Error('Catalog unavailable');
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error('Invalid catalog');
    items = data.items;
  } catch {
    if (status) status.textContent = 'Les filtres sont momentanément indisponibles. Les fiches ci-dessous restent accessibles.';
    return;
  }

  function render() {
    const types = typeButtons.filter(button => button.getAttribute('aria-pressed') === 'true').map(button => button.dataset.type!);
    const list = filterCatalog(items, search?.value ?? '', selectedTags(), mode).filter(item =>
      (!types.length || types.some(type => item.types.includes(type))) && (!artist?.value || item.artists.includes(artist.value)));
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    page = Math.min(Math.max(1, page), pages);
    grid!.innerHTML = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item, i) => musicCardHtml(item, i < 8)).join('');
    grid!.classList.toggle('is-list', view === 'list');
    markActiveButtons('.view-btn', 'view', view);
    markActiveButtons('.mode-btn', 'mode', mode);
    const noun = root!.dataset.kind === 'album' ? 'album' : 'artiste';
    updateFilterStatus(status, empty, list.length, `Aucun ${noun} ne correspond.`, `${list.length} ${noun}${list.length > 1 ? 's' : ''}`);
    // The shared status helper handles tags/types/search; add the album artist filter.
    if (artist?.value && !status?.querySelector('.clear-all-filters') && !empty?.querySelector('.clear-all-filters')) {
      const target = list.length ? status : empty;
      const clear = document.createElement('button');
      clear.type = 'button'; clear.className = 'clear-all-filters ml-3 underline'; clear.textContent = 'Effacer les filtres';
      target?.append(' ', clear);
    }
    renderPager(pager, pages, page);
    writeFilterParams({ search, mode, page, extra: {
      types: types.length ? types.join(',') : null, artist: artist?.value || null, view: view === 'list' ? 'list' : null,
    } });
  }
  const resetPage = () => { page = 1; render(); };
  bindCatalogChrome({ search, pager, status, empty, onResetPage: resetPage,
    onPage(next) { page = next; render(); grid!.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    onMode(next) { mode = next; resetPage(); },
    onView(next) { view = next; render(); },
    onClearAll() {
      uncheckTags(); typeButtons.forEach(button => button.setAttribute('aria-pressed', 'false'));
      if (artist) artist.value = '';
      if (search) search.value = '';
      resetPage();
    },
  });
  artist?.addEventListener('change', resetPage);
  typeButtons.forEach(button => button.addEventListener('click', () => {
    button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true')); resetPage();
  }));
  render();
}
