<script lang="ts">
  import { onMount } from 'svelte';
  import { formatRefLabel, parseReference } from '../../lib/bible-ref';
  import type { BibleTranslation } from '../../lib/bible-translations';

  type Translation = BibleTranslation;
  type Verse = { verse: number; text: string };
  type Column = { code: string; name: string; verses: Verse[] };
  type NavTarget = { book: string; chapter: number; verse?: number | null };
  type Navigation = { prev: NavTarget | null; next: NavTarget | null };

  export let initialTranslations: Translation[] = [];

  let translations: Translation[] = initialTranslations;
  let ref = 'Jean 3:16';
  let numCols = 2;
  let selectedIds: number[] = [];
  let align = true;
  let loading = false;
  let error = '';
  let columns: Column[] = [];
  let current = { book: '', chapter: 0, verse: null as number | null, verseEnd: null as number | null };
  let nav: Navigation = { prev: null, next: null };
  let ready = false;

  onMount(async () => {
    const saved = localStorage.getItem('bible-comparator');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        ref = data.ref ?? ref;
        numCols = Math.min(4, Math.max(1, data.numCols ?? 2));
        selectedIds = Array.isArray(data.selectedIds) ? data.selectedIds : [];
        align = data.align ?? true;
      } catch {}
    }

    if (!translations.length) {
      error = 'La liste des traductions n’a pas pu être chargée.';
      return;
    }

    selectedIds = selectedIds
      .filter((id) => translations.some((translation) => translation.id === id))
      .slice(0, numCols);
    fillSelectedIds();

    ready = true;
    await load();
  });

  function fillSelectedIds() {
    while (selectedIds.length < numCols) {
      const next =
        translations.find((translation) => !selectedIds.includes(translation.id)) ||
        translations[0];
      if (!next) break;
      selectedIds.push(next.id);
    }
    selectedIds = [...selectedIds.slice(0, numCols)];
  }

  function savePrefs() {
    if (!ready) return;
    localStorage.setItem('bible-comparator', JSON.stringify({
      ref, numCols, selectedIds, align
    }));
  }

  function setNumCols(value: number) {
    numCols = value;
    fillSelectedIds();
    savePrefs();
    load();
  }

  function setTranslation(index: number, id: number) {
    selectedIds[index] = id;
    selectedIds = [...selectedIds];
    savePrefs();
    load();
  }

  function metaFor(index: number) {
    return translations.find((translation) => translation.id === selectedIds[index]);
  }

  async function load() {
    if (!ready || !ref.trim() || selectedIds.length === 0) return;
    loading = true;
    error = '';
    savePrefs();

    try {
      const parsed = parseReference(ref);

      if (!parsed.book || !parsed.chapter) {
        error = 'Référence non reconnue. Essayez par exemple « Jean 3:16 » ou « Ps 22 ».';
        columns = [];
        return;
      }

      const params = new URLSearchParams({
        book: parsed.book,
        chapter: String(parsed.chapter)
      });
      if (parsed.verse) params.set('verse', String(parsed.verse));
      if (parsed.verseEnd) params.set('verseEnd', String(parsed.verseEnd));
      selectedIds.forEach(id => params.append('t', String(id)));

      const res = await fetch(`/api/bible/verses?${params}`);
      if (!res.ok) throw new Error('Passage indisponible');
      const data = await res.json();

      columns = data.results ?? [];
      current = {
        book: data.book,
        chapter: data.chapter,
        verse: data.verse || null,
        verseEnd: data.verseEnd || parsed.verseEnd || null,
      };

      nav = data.navigation ?? { prev: null, next: null };

      if (align) {
        requestAnimationFrame(() => alignHeights());
      } else {
        resetHeights();
      }
    } catch (e) {
      error = 'Le passage n’a pas pu être chargé.';
      columns = [];
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function resetHeights() {
    document.querySelectorAll<HTMLElement>('[data-verse]').forEach((element) => {
      element.style.minHeight = 'auto';
    });
  }

  function alignHeights() {
    resetHeights();
    if (window.matchMedia('(max-width: 680px)').matches) return;
    const allNums = new Set<number>();
    columns.forEach(column => column.verses.forEach(verse => allNums.add(verse.verse)));
    allNums.forEach(num => {
      const elements = document.querySelectorAll<HTMLElement>(`[data-verse="${num}"]`);
      let max = 0;
      elements.forEach(element => {
        max = Math.max(max, element.offsetHeight);
      });
      elements.forEach(element => {
        element.style.minHeight = max + 'px';
      });
    });
  }

  async function navigate(dir: 'prev' | 'next') {
    const target = nav[dir];
    if (!target) return;
    ref = target.book + ' ' + target.chapter + (target.verse ? ':' + target.verse : '');
    await load();
  }

  function toggleAlignment() {
    savePrefs();
    requestAnimationFrame(() => align ? alignHeights() : resetHeights());
  }

  function onHover(verse: number, enter: boolean) {
    document.querySelectorAll(`[data-verse="${verse}"]`).forEach(element => {
      element.classList.toggle('highlight', enter);
    });
  }
</script>

<div class="comparator" aria-busy={loading}>
  <section class="comparator-controls" aria-label="Choisir un passage et des traductions">
    <div class="controls-top">
      <div class="reference-field">
        <label for="cmp-ref">Passage</label>
        <div class="reference-input">
          <input
            id="cmp-ref"
            type="text"
            bind:value={ref}
            on:keydown={(event) => event.key === 'Enter' && load()}
            placeholder="Jean 3:16"
            autocomplete="off"
            aria-describedby={error ? 'comparator-error' : undefined}
            aria-invalid={error ? 'true' : undefined}
          />
          <button on:click={load} aria-label="Charger ce passage">Lire <span aria-hidden="true">→</span></button>
        </div>
      </div>

      <fieldset class="column-count">
        <legend>Pages en regard</legend>
        <div>
          {#each [1, 2, 3, 4] as count}
            <button
              type="button"
              class:is-active={numCols === count}
              aria-pressed={numCols === count}
              on:click={() => setNumCols(count)}
            >{count}</button>
          {/each}
        </div>
      </fieldset>

      <label class="align-toggle">
        <input type="checkbox" bind:checked={align} on:change={toggleAlignment} />
        <span>Aligner les versets</span>
      </label>

      <div class="loading-mark" aria-live="polite">
        <span class="cmp-spinner" class:cmp-spinner-on={loading} aria-hidden={!loading}></span>
        <span class="sr-only">{loading ? 'Chargement du passage' : ''}</span>
      </div>
    </div>

    <div class="translation-pickers" style={`--picker-count: ${numCols}`}>
      {#each Array(numCols) as _, index}
        <div class="translation-picker">
          <label for={`cmp-tr-${index}`}>Page {index + 1}</label>
          <select
            id={`cmp-tr-${index}`}
            value={selectedIds[index]}
            on:change={(event) => setTranslation(index, Number(event.currentTarget.value))}
          >
            {#each translations as translation}
              <option value={translation.id}>
                {translation.name_short}{translation.date_label ? ` · ${translation.date_label}` : ''}
              </option>
            {/each}
          </select>
        </div>
      {/each}
    </div>
  </section>

  <nav class="passage-navigation" aria-label="Navigation dans la Bible">
    <button on:click={() => navigate('prev')} disabled={!nav.prev}>
      <span aria-hidden="true">←</span> <span>Précédent</span>
    </button>
    {#if current.book}
      <div aria-live="polite">
        <p>Passage consulté</p>
        <h2>{formatRefLabel(current)}</h2>
      </div>
    {/if}
    <button on:click={() => navigate('next')} disabled={!nav.next}>
      <span>Suivant</span> <span aria-hidden="true">→</span>
    </button>
  </nav>

  {#if error}
    <div id="comparator-error" class="comparator-error" role="alert">
      <p>{error}</p>
    </div>
  {/if}

  {#if columns.length > 0}
    <div class="reading-scroll">
      <div class="reading-columns" style={`--column-count: ${columns.length}`}>
        {#each columns as column, index}
          {@const meta = metaFor(index)}
          <article class="translation-page">
            <header class="translation-header">
              <p class="translation-code">{column.code} · {meta?.language_label || 'Traduction'}</p>
              <h3>{meta?.name_short || column.name}</h3>
              {#if meta && (meta.date_label || meta.authors_label || meta.source_label)}
                <dl>
                  <div>
                    <dt>Date</dt>
                    <dd>{meta.date_label}</dd>
                  </div>
                  <div>
                    <dt>Traducteur</dt>
                    <dd>{meta.authors_label}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{meta.source_label}</dd>
                  </div>
                </dl>
                {#if meta.notice}
                  <details>
                    <summary>Notice de l’édition</summary>
                    <p>{meta.notice}</p>
                  </details>
                {/if}
              {/if}
            </header>

            <div class="verses">
              {#each column.verses as verse}
                <div
                  class="verse"
                  data-verse={verse.verse}
                  on:mouseenter={() => onHover(verse.verse, true)}
                  on:mouseleave={() => onHover(verse.verse, false)}
                  role="presentation"
                >
                  <span class="verse-number">{verse.verse}</span>
                  <p>{verse.text}</p>
                </div>
              {/each}
            </div>
          </article>
        {/each}
      </div>
    </div>
  {:else if ready && !loading && !error}
    <p class="empty-state">Choisissez un passage pour commencer la lecture.</p>
  {/if}
</div>

<style>
  .comparator {
    --control-height: 2.75rem;
  }

  .comparator-controls {
    position: sticky;
    z-index: 20;
    top: 4.75rem;
    padding: 1.1rem clamp(1rem, 2.2vw, 1.75rem) 1rem;
    border: 1px solid var(--border);
    background: color-mix(in oklab, var(--card) 94%, transparent);
    backdrop-filter: blur(12px);
    box-shadow: 0 16px 28px -30px rgba(30, 20, 12, 0.75);
  }

  .controls-top {
    display: grid;
    grid-template-columns: minmax(15rem, 1fr) auto auto 1.5rem;
    gap: 1.25rem;
    align-items: end;
  }

  label,
  legend {
    display: block;
    margin-bottom: 0.35rem;
    color: var(--text-subtle);
    font-family: var(--type-ui);
    font-size: 0.64rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .reference-input {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    height: var(--control-height);
    border-bottom: 1px solid var(--text);
  }

  .reference-input input {
    min-width: 0;
    padding: 0 0.35rem;
    border: 0;
    background: transparent;
    color: var(--text);
    font-family: var(--type-display);
    font-size: 1.3rem;
  }

  .reference-input:focus-within {
    border-color: var(--accent);
  }

  .reference-input input:focus-visible,
  .translation-picker select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  .reference-input button {
    padding: 0 0.55rem;
    color: var(--accent);
    font-family: var(--type-ui);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .column-count > div {
    display: flex;
    height: var(--control-height);
    border: 1px solid var(--border);
  }

  .column-count button {
    width: 2.45rem;
    border-right: 1px solid var(--border);
    color: var(--text-muted);
    font-family: var(--type-ui);
    font-size: 0.78rem;
  }

  .column-count button:last-child {
    border-right: 0;
  }

  .column-count button.is-active {
    background: var(--accent);
    color: var(--accent-fg);
  }

  .align-toggle {
    display: flex;
    height: var(--control-height);
    align-items: center;
    gap: 0.55rem;
    margin: 0;
    color: var(--text-muted);
    font-size: 0.68rem;
    letter-spacing: 0.045em;
    text-transform: none;
  }

  .align-toggle input {
    width: 0.95rem;
    height: 0.95rem;
    accent-color: var(--accent);
  }

  .loading-mark {
    display: grid;
    width: 1.5rem;
    height: var(--control-height);
    place-items: center;
  }

  .translation-pickers {
    display: grid;
    grid-template-columns: repeat(var(--picker-count), minmax(0, 1fr));
    gap: 1rem;
    margin-top: 0.85rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--border);
  }

  .translation-picker label {
    margin-bottom: 0.15rem;
  }

  .translation-picker select {
    width: 100%;
    padding: 0.35rem 1.5rem 0.35rem 0;
    border: 0;
    background: transparent;
    color: var(--text);
    font-family: var(--type-body);
    font-size: 0.85rem;
  }

  .passage-navigation {
    display: grid;
    grid-template-columns: 1fr minmax(12rem, auto) 1fr;
    gap: 1rem;
    align-items: center;
    padding: 2.3rem 0 1.5rem;
  }

  .passage-navigation > div {
    text-align: center;
  }

  .passage-navigation p {
    color: var(--text-subtle);
    font-family: var(--type-ui);
    font-size: 0.62rem;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .passage-navigation h2 {
    margin-top: 0.2rem;
    font-family: var(--type-display);
    font-size: clamp(1.8rem, 3vw, 2.5rem);
    line-height: 1;
  }

  .passage-navigation button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-muted);
    font-family: var(--type-ui);
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .passage-navigation button:last-child {
    justify-self: end;
  }

  .passage-navigation button:disabled {
    opacity: 0.28;
  }

  .reading-scroll {
    overflow-x: auto;
    padding-bottom: 0.75rem;
  }

  .reading-columns {
    display: grid;
    min-width: calc(var(--column-count) * 20rem);
    grid-template-columns: repeat(var(--column-count), minmax(20rem, 1fr));
    gap: 1px;
    border: 1px solid var(--border);
    background: var(--border);
  }

  .translation-page {
    min-width: 0;
    background: var(--card);
  }

  .translation-header {
    min-height: 14.5rem;
    padding: 1.5rem clamp(1.1rem, 2.5vw, 2rem) 1.25rem;
    border-bottom: 1px solid var(--border);
  }

  .translation-code {
    color: var(--gold);
    font-family: var(--type-ui);
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .translation-header h3 {
    margin-top: 0.45rem;
    font-family: var(--type-display);
    font-size: clamp(1.75rem, 2.7vw, 2.45rem);
    line-height: 1;
  }

  .translation-header dl {
    display: grid;
    grid-template-columns: 0.72fr 1.25fr 1.2fr;
    gap: 0.75rem;
    margin-top: 1.2rem;
  }

  .translation-header dt {
    color: var(--text-subtle);
    font-family: var(--type-ui);
    font-size: 0.57rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .translation-header dd {
    margin-top: 0.18rem;
    color: var(--text-muted);
    font-size: 0.7rem;
    line-height: 1.35;
  }

  details {
    margin-top: 1rem;
    color: var(--text-subtle);
    font-size: 0.72rem;
  }

  summary {
    cursor: pointer;
    font-family: var(--type-ui);
    font-size: 0.62rem;
    letter-spacing: 0.05em;
    text-decoration: underline;
    text-underline-offset: 0.25em;
    text-transform: uppercase;
  }

  details p {
    margin-top: 0.55rem;
    line-height: 1.5;
  }

  .verses {
    padding: 0.7rem 0;
  }

  .verse {
    display: grid;
    grid-template-columns: 1.7rem minmax(0, 1fr);
    gap: 0.7rem;
    padding: 0.72rem clamp(1rem, 2.2vw, 1.8rem);
    transition: background 120ms ease;
  }

  .verse.highlight {
    background: color-mix(in oklab, var(--accent) 9%, transparent);
  }

  .verse-number {
    padding-top: 0.18rem;
    color: var(--gold);
    font-family: var(--type-ui);
    font-size: 0.62rem;
    text-align: right;
    user-select: none;
  }

  .verse p {
    font-size: clamp(0.98rem, 1.25vw, 1.12rem);
    line-height: 1.62;
  }

  .comparator-error,
  .empty-state {
    margin: 1rem 0;
    padding: 1rem 1.2rem;
    border-left: 2px solid var(--accent);
    background: color-mix(in oklab, var(--accent) 7%, transparent);
    color: var(--text-muted);
  }

  .cmp-spinner {
    width: 1.05rem;
    height: 1.05rem;
    border: 1px solid color-mix(in oklab, var(--text) 20%, transparent);
    border-top-color: var(--gold);
    border-radius: 999px;
    opacity: 0;
    transition: opacity 180ms ease;
  }

  .cmp-spinner-on {
    opacity: 1;
    animation: cmp-spin 700ms linear infinite;
  }

  @keyframes cmp-spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 900px) {
    .controls-top {
      grid-template-columns: minmax(15rem, 1fr) auto 1.5rem;
    }

    .align-toggle {
      grid-column: 1 / -1;
      height: auto;
    }

    .translation-pickers {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 680px) {
    .comparator-controls {
      top: 4.75rem;
      margin-inline: -0.625rem;
      padding-inline: 0.75rem;
    }

    .controls-top {
      grid-template-columns: 1fr auto;
      gap: 0.8rem;
    }

    .reference-field {
      grid-column: 1 / -1;
    }

    .loading-mark {
      display: none;
    }

    .align-toggle {
      grid-column: auto;
      justify-self: end;
    }

    .translation-pickers {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x proximity;
    }

    .translation-picker {
      min-width: 13.5rem;
      scroll-snap-align: start;
    }

    .passage-navigation {
      grid-template-columns: auto 1fr auto;
      padding-top: 1.7rem;
    }

    .passage-navigation button span:not([aria-hidden]) {
      display: none;
    }

    .reading-columns {
      min-width: 0;
      grid-template-columns: 1fr;
    }

    .translation-header {
      min-height: 0;
    }
  }
</style>
