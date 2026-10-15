<script lang="ts">
  import { onMount } from 'svelte';
  import { offlineRequest, offlineStatus } from '../../lib/offline/client';
  import { isInstalledComparator } from '../../lib/offline/display-mode';
  import { cachedRelease, checkBibleRelease } from '../../lib/offline/releases';
  import type { OfflineBible } from '../../lib/offline/types';

  export let metadata: OfflineBible;
  export let onready: () => void;
  type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
  let expanded = false;
  let saved: OfflineBible | null = null;
  let latest: OfflineBible | null = null;
  let dismissed = false;
  let checking = false;
  let checkedAt = 0;
  let checkMessage = '';
  let supported = false;
  let ios = false;
  let standalone = false;
  let installationHelp = false;
  let installEvent: InstallEvent | null = null;
  let registration: ServiceWorkerRegistration | undefined;
  let shell: Promise<ServiceWorkerRegistration> | undefined;
  let updateAvailable = false;
  let reloading = false;
  let busy = false;
  let cancelled = false;
  let progress = 0;
  let message = '';
  let problem = '';
  let persistent = false;
  const megabytes = (bytes: number) => (bytes / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  $: target = standalone && latest ? latest : metadata;
  $: outdated = standalone && saved && latest && saved.sha256 !== latest.sha256;

  onMount(() => {
    supported = window.isSecureContext && 'serviceWorker' in navigator && 'indexedDB' in window && 'WebAssembly' in window && 'Worker' in window;
    ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    standalone = isInstalledComparator();
    const offerInstall = (event: Event) => { event.preventDefault(); installEvent = event as InstallEvent; };
    const installed = () => { standalone = isInstalledComparator(); installEvent = null; };
    let controlled = Boolean(navigator.serviceWorker?.controller);
    const changed = () => {
      if (reloading || controlled) location.reload();
      controlled = true;
    };
    const reopen = () => {
      if (!standalone || document.visibilityState !== 'visible') return;
      dismissed = false;
      void checkForUpdate();
      void registration?.update().catch(() => {});
    };
    let wasHidden = document.visibilityState === 'hidden';
    const visibilityChanged = () => {
      if (document.visibilityState === 'hidden') wasHidden = true;
      else if (wasHidden) { wasHidden = false; reopen(); }
    };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) reopen(); };
    const reconnected = () => { if (standalone) void checkForUpdate(); };
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('pageshow', restored);
    window.addEventListener('online', reconnected);
    window.addEventListener('beforeinstallprompt', offerInstall);
    window.addEventListener('appinstalled', installed);
    navigator.serviceWorker?.addEventListener('controllerchange', changed);
    if (supported && import.meta.env.PROD) {
      if (standalone) {
        const previous = cachedRelease();
        latest = previous?.bible ?? null;
        checkedAt = previous?.checkedAt ?? 0;
      }
      shell = prepareShell();
      void shell.catch(error => { problem = error.message; });
      void offlineStatus().then(value => {
        saved = value;
        if (standalone) void checkForUpdate();
      }).catch(() => { problem = 'Le stockage local est indisponible dans ce navigateur.'; });
      void navigator.storage?.persisted?.().then(value => { persistent = value; }).catch(() => {});
    }
    return () => {
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('pageshow', restored);
      window.removeEventListener('online', reconnected);
      window.removeEventListener('beforeinstallprompt', offerInstall);
      window.removeEventListener('appinstalled', installed);
      navigator.serviceWorker?.removeEventListener('controllerchange', changed);
    };
  });

  async function checkForUpdate() {
    if (!standalone || checking || busy) return;
    if (!navigator.onLine) { checkMessage = 'La vérification reprendra au retour du réseau.'; return; }
    checking = true;
    try {
      const checked = await checkBibleRelease();
      latest = checked.bible; checkedAt = checked.checkedAt; checkMessage = '';
      // Older builds stored a fixed "1.1.0" label even for a more recent file.
      // A matching digest lets us repair that label without transferring the DB.
      saved = await offlineStatus(checked.bible);
    } catch {
      checkMessage = 'Vérification impossible pour le moment. Votre Bible locale reste utilisable.';
    } finally { checking = false; }
  }

  async function prepareShell() {
    registration = await navigator.serviceWorker.register('/scriptorium/sw.js', { scope: '/scriptorium/', updateViaCache: 'none' });
    const observe = () => {
      updateAvailable = Boolean(registration?.waiting && registration.active);
      const installing = registration?.installing;
      installing?.addEventListener('statechange', () => {
        updateAvailable = Boolean(registration?.waiting && registration.active);
      });
    };
    observe();
    registration.addEventListener('updatefound', observe);
    if (!registration.active) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('La préparation hors ligne a échoué. Vérifiez la connexion et rechargez la page.')), 60000);
        navigator.serviceWorker.ready.then(() => { clearTimeout(timeout); resolve(); }, reject);
      });
    }
    return registration;
  }

  async function install() {
    const event = installEvent;
    if (!event) { installationHelp = true; return; }
    installEvent = null;
    await event.prompt();
    await event.userChoice;
  }

  async function download() {
    const downloadMetadata = { ...target };
    expanded = true;
    busy = true; cancelled = false; progress = 0; problem = ''; message = 'Préparation du lecteur…';
    try {
      if (!shell) throw new Error('Le mode hors ligne nécessite le site en HTTPS.');
      await shell;
      if (cancelled) throw new Error('Téléchargement annulé.');
      const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
      // Leave headroom for the existing copy during an atomic update.
      if (estimate?.quota && estimate.quota - (estimate.usage || 0) < downloadMetadata.bytes * 1.2) {
        throw new Error('Espace insuffisant. Libérez de la place sur cet appareil, puis réessayez.');
      }
      persistent = await navigator.storage?.persist?.().catch(() => false) || false;
      if (cancelled) throw new Error('Téléchargement annulé.');
      message = 'Téléchargement de toutes les traductions…';
      saved = await offlineRequest<OfflineBible>('download', {metadata: downloadMetadata}, value => { progress = value; if (value === 1) message = 'Vérification et enregistrement…'; });
      message = 'La Bible et le lecteur sont disponibles hors ligne sur cet appareil.';
      onready();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Le téléchargement a échoué. Réessayez.';
      if (detail === 'Téléchargement annulé.') message = detail;
      else { problem = detail; message = ''; }
    } finally { busy = false; }
  }

  async function cancel() {
    cancelled = true;
    try { await offlineRequest('cancel'); } catch {}
  }
  async function remove() {
    if (!confirm('Supprimer la Bible téléchargée de cet appareil ? Vous pourrez la télécharger à nouveau.')) return;
    problem = '';
    try { await offlineRequest('remove'); saved = null; message = 'La copie locale a été supprimée.'; onready(); }
    catch { problem = 'La copie locale n’a pas pu être supprimée.'; }
  }
  function updateApp() {
    if (busy || !registration?.waiting) return;
    reloading = true;
    registration.waiting.postMessage('ACTIVATE_UPDATE');
  }
</script>

<section class="offline-panel" aria-label="Installer et lire hors ligne">
  {#if standalone && outdated && !dismissed && !busy && !expanded}
    <aside class="bible-update-notice" role="status" aria-label="Mise à jour de la Bible">
      <div><strong>Une nouvelle Bible est disponible</strong><p>Version {target.version} · {megabytes(target.bytes)} Mo à télécharger.</p></div>
      <div class="offline-actions">
        <button type="button" on:click={download}>Mettre à jour la Bible</button>
        <button type="button" on:click={() => dismissed = true}>Plus tard</button>
      </div>
    </aside>
  {/if}
  <details bind:open={expanded}>
    <summary><span>Emporter le comparateur</span><span class="offline-state">{updateAvailable ? 'Actualiser' : saved ? 'Bible téléchargée' : `${megabytes(target.bytes)} Mo`}</span></summary>
    <div class="offline-body">
      {#if import.meta.env.DEV}
        <p>Le mode hors ligne s’active sur le build de production.</p>
      {:else if !supported}
        <p>Le mode hors ligne nécessite un navigateur récent, un stockage local autorisé et une connexion HTTPS.</p>
      {:else}
        <ol class="setup-steps">
          <li>
            <h3>{standalone ? 'Votre Bible dans cette application' : '1. Télécharger la copie locale'}</h3>
            <p>Toutes les traductions · {megabytes(target.bytes)} Mo · de préférence en Wi-Fi.</p>
            {#if outdated}<p>Une nouvelle version est disponible. Votre copie actuelle reste utilisable pendant la mise à jour.</p>{/if}
            <div class="offline-actions">
              {#if !saved || outdated}<button type="button" disabled={busy} on:click={download}>{saved ? 'Mettre à jour la Bible' : 'Télécharger la Bible'}</button>{/if}
              {#if busy}<button type="button" disabled={progress === 1} on:click={cancel}>Annuler</button>{/if}
              {#if saved}<button type="button" disabled={busy} on:click={remove}>Supprimer la copie locale</button>{/if}
            </div>
            {#if busy}<progress max="1" value={progress} aria-label="Téléchargement de la Bible"></progress><p>{Math.round(progress * 100)} %</p>{/if}
            {#if saved}<p>Version locale : {saved.version}. {persistent ? 'Stockage persistant accordé.' : 'Le système peut libérer ce stockage en cas de manque de place.'} Effacer les données du site supprime la copie locale.</p>{/if}
          </li>
          {#if !standalone}
            <li>
              <h3>2. Installer le comparateur</h3>
              <button type="button" disabled={busy} on:click={install}>Installer le comparateur</button>
              {#if installationHelp}
                {#if ios}
                  <p><strong>Sur iPhone ou iPad :</strong> dans Safari, touchez <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong> (ou « Ajouter à l’écran d’accueil »). Ouvrez ensuite Literae depuis son icône.</p>
                {:else}
                  <p>Dans le menu de votre navigateur, choisissez <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>, si cette option est proposée.</p>
                {/if}
              {/if}
              {#if ios}<p>Sur iPhone/iPad, le stockage de Safari peut être séparé de celui de l’application. Si la copie n’est pas reprise, téléchargez la Bible depuis l’application installée.</p>{/if}
            </li>
          {/if}
        </ol>
      {/if}
      {#if standalone}
        <p>{checking ? 'Recherche d’une nouvelle version…' : checkMessage || (checkedAt ? `Dernière vérification : ${new Date(checkedAt).toLocaleString('fr-FR')}.` : '')}</p>
        <button type="button" disabled={checking || busy} on:click={checkForUpdate}>Vérifier les mises à jour de la Bible</button>
      {/if}
      {#if updateAvailable}
        <p>Une nouvelle version du comparateur est disponible.</p>
        <button type="button" disabled={busy} on:click={updateApp}>Actualiser l’application</button>
      {/if}
      <p role="status">{message}</p>
      {#if problem}<p role="alert">{problem}</p>{/if}
    </div>
  </details>
</section>

<style>
  .bible-update-notice { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem 1rem; padding: .75rem 1rem; border-bottom: 1px solid var(--border); font-size: .9rem; line-height: 1.4; }
  .bible-update-notice p { margin: .25rem 0 0; }
  .bible-update-notice .offline-actions { margin-top: 0; }
  :global(html[data-comparator-mode="standalone"]) .offline-panel { margin-bottom: .5rem; }
  .offline-panel { max-width: 120rem; margin: 0 auto 1.25rem; border: 1px solid var(--border); background: var(--card); color: var(--text-muted); }
  summary { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem; min-height: 2.75rem; padding: .5rem .75rem; cursor: pointer; font-family: var(--type-ui); font-size: .85rem; }
  summary::after { content: '+'; color: var(--accent); }
  details[open] summary::after { content: '−'; }
  .offline-state { margin-left: auto; color: var(--accent); font-size: .75rem; }
  .setup-steps { display: grid; gap: 1rem; margin: 0; padding: 0; list-style: none; }
  .setup-steps h3 { margin-bottom: .4rem; color: var(--text); font-size: 1rem; line-height: 1.3; }
  .setup-steps h3 + button { margin-top: .35rem; }
  .offline-body { padding: 0 1rem 1rem; font-size: .95rem; line-height: 1.55; }
  p + p, button + p, .offline-actions { margin-top: .75rem; }
  p:empty { display: none; }
  button { min-height: 2.75rem; border: 1px solid var(--border); padding: .5rem .85rem; color: var(--accent); font-family: var(--type-ui); font-size: .8rem; cursor: pointer; }
  button:disabled { opacity: .5; cursor: wait; }
  button:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  .offline-actions { display: flex; flex-wrap: wrap; gap: .6rem; }
  progress { display: block; width: 100%; margin-top: 1rem; accent-color: var(--accent); }
  [role="alert"] { color: var(--accent); }
  @media (max-width: 600px) { summary { font-size: .8rem; } .offline-state { margin-left: 0; } }
</style>
