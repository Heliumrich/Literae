export type OfflineBible = { sha256: string; bytes: number; url: string; version: string };
export type StoredBible = OfflineBible & { blob: Blob };
export type WorkerRequest = { id: number; type: 'status' | 'download' | 'cancel' | 'remove' | 'query'; metadata?: OfflineBible; params?: string; codes?: string[] };
