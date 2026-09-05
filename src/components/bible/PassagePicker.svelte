<script lang="ts">
  import { tick } from 'svelte';
  import type { BibleCatalogBook } from '../../lib/bible-navigation';

  export let books: BibleCatalogBook[] = [];
  export let currentBook = '';
  export let currentChapter = 0;
  export let onselect: (book: string, chapter: number) => void;

  const testaments = [
    { code: 'OT', name: 'Ancien Testament' },
    { code: 'NT', name: 'Nouveau Testament' },
  ];
  let open = false;
  let selectedBook: BibleCatalogBook | null = null;
  let trigger: HTMLButtonElement;
  let panel: HTMLDivElement;
  let heading: HTMLHeadingElement;
  let body: HTMLDivElement;
  let placement = '';

  function positionPanel() {
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(768, window.innerWidth - 32);
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
    // Keep the chooser usable even in landscape with little room below the field.
    const top = Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - Math.min(384, window.innerHeight - 24)));
    placement = `left: ${left}px; top: ${top}px; width: ${width}px; max-height: ${Math.min(520, window.innerHeight - top - 16)}px`;
  }

  function prepareOpen() {
    if (!open) selectedBook = null;
    positionPanel();
  }

  async function handleToggle() {
    open = panel.matches(':popover-open');
    if (open) {
      await tick();
      body.scrollTop = 0;
      heading.focus({ preventScroll: true });
    }
  }

  async function chooseBook(book: BibleCatalogBook | null) {
    selectedBook = book;
    await tick();
    body.scrollTop = 0;
    heading.focus({ preventScroll: true });
  }

  function chooseChapter(chapter: number) {
    if (!selectedBook) return;
    onselect(selectedBook.code, chapter);
    panel.hidePopover();
    trigger.focus({ preventScroll: true });
  }

  function jumpToTestament(code: string) {
    const section = panel.querySelector<HTMLElement>(`#picker-${code}`);
    section?.scrollIntoView({ block: 'start' });
    section?.focus({ preventScroll: true });
  }
</script>

<svelte:window on:resize={positionPanel} on:scroll={() => open && positionPanel()} />

<button
  bind:this={trigger}
  type="button"
  class="picker-trigger"
  popovertarget="passage-picker"
  aria-label="Choisir un livre et un chapitre"
  aria-haspopup="dialog"
  aria-expanded={open}
  on:click={prepareOpen}
>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
</button>

<div bind:this={panel} id="passage-picker" class="passage-picker" popover="auto" role="dialog" aria-labelledby="passage-picker-title" style={placement} on:toggle={handleToggle}>
  <div class="picker-header">
    {#if selectedBook}
      <button class="back-button" type="button" on:click={() => chooseBook(null)} aria-label="Retour aux livres">← <span>Livres</span></button>
    {/if}
    <h2 bind:this={heading} id="passage-picker-title" tabindex="-1">{selectedBook ? selectedBook.name : 'Choisir un livre'}</h2>
    <button class="close-button" type="button" popovertarget="passage-picker" popovertargetaction="hide" aria-label="Fermer le sélecteur">×</button>
  </div>
  {#if !selectedBook}
    <div class="testament-shortcuts">
      {#each testaments as testament}
        <button type="button" on:click={() => jumpToTestament(testament.code)}>{testament.name}</button>
      {/each}
    </div>
  {/if}
  <div class="picker-body" bind:this={body}>
    {#if selectedBook}
      <p class="chapter-label">Choisir un chapitre</p>
      <div class="chapter-grid">
        {#each selectedBook.chapters as _, index}
          <button type="button" aria-label={`${selectedBook.name}, chapitre ${index + 1}`} aria-current={selectedBook.code === currentBook && index + 1 === currentChapter ? 'true' : undefined} on:click={() => chooseChapter(index + 1)}>{index + 1}</button>
        {/each}
      </div>
    {:else}
      <div class="testaments">
        {#each testaments as testament}
          <section aria-labelledby={`picker-${testament.code}`}>
            <h3 id={`picker-${testament.code}`} tabindex="-1">{testament.name}</h3>
            <div class="book-grid">
              {#each books.filter(book => book.testament === testament.code) as book}
                <button type="button" aria-current={book.code === currentBook ? 'true' : undefined} on:click={() => chooseBook(book)}>{book.name}</button>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  button { color: var(--text); cursor: pointer; }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .picker-trigger { display: grid; place-items: center; width: 2.75rem; height: 100%; border-right: 1px solid var(--border); }
  .picker-trigger[aria-expanded="true"] { color: var(--accent); background: var(--bg-secondary); }
  .passage-picker {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    box-shadow: 0 12px 40px rgba(30, 20, 12, 0.2);
    overflow: hidden;
  }
  .passage-picker:popover-open { display: flex; flex-direction: column; }
  .picker-header { display: flex; flex: none; align-items: center; gap: 0.75rem; padding: 0.5rem 1rem; border-bottom: 1px solid var(--border); }
  .picker-header h2 { flex: 1; font-family: var(--type-display); font-size: 1.7rem; line-height: 1.1; }
  h2:focus, h3:focus { outline: none; }
  .close-button { min-width: 2.75rem; min-height: 2.75rem; font-size: 1.6rem; }
  .back-button { min-height: 2.75rem; font-family: var(--type-ui); font-size: 0.75rem; }
  .picker-body { padding: 1rem; overflow-y: auto; overscroll-behavior: contain; }
  .testaments { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .testaments h3, .chapter-label { margin-bottom: 0.75rem; color: var(--gold); font-family: var(--type-ui); font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; }
  .book-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.15rem 0.35rem; }
  .book-grid button { min-height: 2.75rem; padding: 0.4rem 0.5rem; text-align: left; font-size: 0.85rem; line-height: 1.25; overflow-wrap: anywhere; }
  .chapter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(2.75rem, 1fr)); gap: 0.4rem; }
  .chapter-grid button { min-height: 2.75rem; border: 1px solid var(--border); font-family: var(--type-ui); font-size: 0.85rem; }
  .book-grid button:hover, .chapter-grid button:hover { background: var(--bg-secondary); }
  button[aria-current="true"] { color: var(--accent); background: color-mix(in oklab, var(--accent) 9%, var(--card)); font-weight: 600; }
  .testament-shortcuts { display: none; }
  @media (max-width: 600px) {
    .picker-header { padding-inline: 0.65rem; }
    .picker-header h2 { font-size: 1.5rem; }
    .picker-body { padding: 0.75rem; }
    .testaments { grid-template-columns: 1fr; }
    .testament-shortcuts { display: flex; flex: none; gap: 0.5rem; padding: 0 0.75rem; border-bottom: 1px solid var(--border); }
    .testament-shortcuts button { flex: 1; min-height: 2.75rem; font-family: var(--type-ui); font-size: 0.65rem; }
  }
</style>
