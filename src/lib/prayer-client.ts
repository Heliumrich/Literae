import {
  bindCatalogChrome,
  escapeHtml,
  filterCatalog,
  markActiveButtons,
  readFilterParams,
  renderPager,
  selectedTags,
  uncheckTags,
  updateFilterStatus,
  writeFilterParams,
  type CatalogView,
  type FilterMode,
} from "./catalog-ui";

type Item = {
  slug: string;
  href: string;
  title: string;
  titleLatin: string;
  description: string;
  lead: string;
  tags: string[];
  haystack: string;
};

const PAGE_SIZE = 20;

function cardHtml(item: Item, view: CatalogView, index: number) {
  const body = view === "list" ? item.description : item.lead;
  return `<article class="prayer-card">
    <p class="prayer-number">${String(index + 1).padStart(2, "0")}</p>
    <a class="prayer-card-link" href="${escapeHtml(item.href)}">
      <h2>${escapeHtml(item.title)}</h2>
      ${item.titleLatin ? `<p class="prayer-latin">${escapeHtml(item.titleLatin)}</p>` : ""}
    </a>
    ${body ? `<p class="prayer-excerpt ${view === "list" ? "whitespace-pre-line" : ""}">${escapeHtml(body)}</p>` : ""}
  </article>`;
}

export function initPrayerList(jsonUrl: string) {
  const grid = document.getElementById("catalog-grid");
  const empty = document.getElementById("catalog-empty");
  const pager = document.getElementById("catalog-pager");
  const status = document.getElementById("catalog-status");
  const search = document.getElementById("catalog-search") as HTMLInputElement | null;
  if (!grid) return;
  const prayerGrid = grid;

  let items: Item[] = [];
  const initial = readFilterParams(search);
  let mode: FilterMode = initial.mode;
  let view: CatalogView = initial.view;
  let page = initial.page;

  function render() {
    const list = filterCatalog(items, search?.value || "", selectedTags(), mode);
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    prayerGrid.innerHTML = list
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map((item, index) => cardHtml(item, view, (page - 1) * PAGE_SIZE + index))
      .join("");
    prayerGrid.classList.toggle("is-grid", view === "grid");
    prayerGrid.classList.toggle("is-list", view === "list");
    markActiveButtons(".view-btn", "view", view);
    markActiveButtons(".mode-btn", "mode", mode);
    const noun = list.length > 1 ? "prières" : "prière";
    updateFilterStatus(status, empty, list.length, "Aucune prière ne correspond.", `${list.length} ${noun}`);
    renderPager(pager, pages, page);
    writeFilterParams({
      search,
      mode,
      page,
      extra: { view: view === "list" ? "list" : null },
    });
  }

  bindCatalogChrome({
    search,
    pager,
    status,
    empty,
    onResetPage() {
      page = 1;
      render();
    },
    onPage(next) {
      page = next;
      render();
      prayerGrid.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    onMode(next) {
      mode = next;
      page = 1;
      render();
    },
    onView(next) {
      view = next;
      page = 1;
      render();
    },
    onClearAll() {
      uncheckTags();
      if (search) search.value = "";
      page = 1;
      render();
    },
  });

  fetch(jsonUrl)
    .then((res) => res.json())
    .then((data) => {
      items = data.items || [];
      render();
    })
    .catch(() => {});
}
