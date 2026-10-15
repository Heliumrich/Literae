import type { OfflineBible, StoredBible } from './types';
const DATABASE = 'literae-bible';
const STORE = 'database';

async function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storedBible(value?: StoredBible | null): Promise<StoredBible | undefined> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, value === undefined ? 'readonly' : 'readwrite');
      const store = tx.objectStore(STORE);
      const request = value === undefined ? store.get('current') : value === null ? store.delete('current') : store.put(value, 'current');
      tx.oncomplete = () => resolve(value === undefined ? request.result : value ?? undefined);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Stockage local indisponible.'));
    });
  } finally { db.close(); }
}

/** Correct an old release label without downloading or replacing its bytes. */
export async function updateBibleMetadata(metadata: OfflineBible): Promise<StoredBible | undefined> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const request = store.get('current');
      let current: StoredBible | undefined;
      request.onsuccess = () => {
        current = request.result;
        // Read and compare inside the write transaction: another tab may have updated it.
        if (current?.sha256 === metadata.sha256 && current.bytes === metadata.bytes) {
          current = { ...current, version: metadata.version, url: metadata.url };
          store.put(current, 'current');
        }
      };
      tx.oncomplete = () => resolve(current);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Stockage local indisponible.'));
    });
  } finally { db.close(); }
}
