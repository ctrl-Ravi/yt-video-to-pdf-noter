import { getDb } from '../database';
import { SyncQueueEntry, SyncStatus } from '@yt-noter-pro/shared-types';

export async function enqueueOperation(entry: SyncQueueEntry): Promise<void> {
  const db = getDb();
  await db.syncQueue.put(entry);
}

export async function getDueOperations(): Promise<SyncQueueEntry[]> {
  const db = getDb();
  const now = Date.now();
  return db.syncQueue.where('nextRetryTimestamp').belowOrEqual(now).filter(op => op.status !== 'error').toArray();
}

export async function markSyncSuccess(uuid: string): Promise<void> {
  const db = getDb();
  await db.syncQueue.delete(uuid);
}

export async function incrementRetry(uuid: string, nextRetryTimestamp: number): Promise<void> {
  const db = getDb();
  const entry = await db.syncQueue.get(uuid);
  if (entry) {
    entry.retryCount += 1;
    entry.nextRetryTimestamp = nextRetryTimestamp;
    await db.syncQueue.put(entry);
  }
}

export async function markSyncError(uuid: string): Promise<void> {
  const db = getDb();
  const entry = await db.syncQueue.get(uuid);
  if (entry) {
    entry.status = 'error';
    await db.syncQueue.put(entry);
  }
}
