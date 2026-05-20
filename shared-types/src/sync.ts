export type SyncStatus = 'local-only' | 'pending-sync' | 'synced' | 'conflict' | 'error';

export interface SyncQueueEntry {
  uuid: string;
  noteUuid: string;
  targetProvider: string;
  status: 'pending' | 'error' | 'success';
  retryCount: number;
  nextRetryTimestamp: number;
}
