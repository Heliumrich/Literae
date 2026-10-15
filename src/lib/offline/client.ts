import BibleWorker from './bible.worker?worker';
import type { OfflineBible, WorkerRequest } from './types';
import type { readBiblePassage } from '../bible-query';
let worker: Worker | undefined;
let sequence = 0;
const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void; progress?: (value: number) => void }>();
export function offlineRequest<T>(type: WorkerRequest['type'], payload: Partial<WorkerRequest> = {}, progress?: (value: number) => void): Promise<T> {
  if (!worker) {
    worker = new BibleWorker();
    worker.onmessage = ({ data }) => {
      const request = pending.get(data.id);
      if (!request) return;
      if (data.progress !== undefined) { request.progress?.(data.progress); return; }
      pending.delete(data.id);
      if (data.error) request.reject(new Error(data.error)); else request.resolve(data.result);
    };
    worker.onerror = () => {
      for (const request of pending.values()) request.reject(new Error('Le lecteur local a rencontré une erreur. Rechargez la page.'));
      pending.clear(); worker?.terminate(); worker = undefined;
    };
  }
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, progress });
    // Svelte props can be proxies, which structured cloning cannot transfer.
    const metadata = payload.metadata ? { ...payload.metadata } : undefined;
    try { worker!.postMessage({ id, type, metadata, params: payload.params, codes: payload.codes ? Array.from(payload.codes) : undefined }); }
    catch (error) { pending.delete(id); reject(error); }
  });
}
export const offlineStatus = (metadata?: OfflineBible) => offlineRequest<OfflineBible | null>('status', {metadata});
export const offlineQuery = (params: URLSearchParams, codes: string[]) => offlineRequest<ReturnType<typeof readBiblePassage>>('query', {params: params.toString(), codes});
