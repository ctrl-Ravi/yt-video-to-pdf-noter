import { getDb } from '../database';
import { readPreferences, writePreference } from './preferences';
import { deleteExpiredExportCache } from './export';

export interface StorageQuotaResult {
  usedBytes: number;
  quotaBytes: number;
  percentUsed: number;
}

export async function checkStorageQuota(): Promise<StorageQuotaResult> {
  let usedBytes = 0;
  let quotaBytes = 0;
  let percentUsed = 0;

  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    usedBytes = estimate.usage || 0;
    quotaBytes = estimate.quota || 0;
    if (quotaBytes > 0) {
      percentUsed = (usedBytes / quotaBytes) * 100;
    }
  }

  await writePreference('storageUsagePercent', percentUsed);
  await writePreference('lastQuotaCheckTimestamp', Date.now());

  return { usedBytes, quotaBytes, percentUsed };
}

export async function isStorageWarning(): Promise<boolean> {
  const prefs = await readPreferences();
  return (prefs.storageUsagePercent ?? 0) > 80;
}

export async function orphanedScreenshotCleanup(): Promise<void> {
  const db = getDb();
  
  const allNotes = await db.notes.toArray();
  const noteUuids = new Set(allNotes.map(n => n.uuid));
  
  await db.transaction('rw', [db.thumbnails, db.screenshots], async () => {
    const thumbKeys = await db.thumbnails.toCollection().primaryKeys();
    const thumbsToDelete = thumbKeys.filter(key => !noteUuids.has(key));
    if (thumbsToDelete.length > 0) {
      await db.thumbnails.bulkDelete(thumbsToDelete);
    }
    
    const screenKeys = await db.screenshots.toCollection().primaryKeys();
    const screensToDelete = screenKeys.filter(key => !noteUuids.has(key));
    if (screensToDelete.length > 0) {
      await db.screenshots.bulkDelete(screensToDelete);
    }
  });
}

export async function weeklyCleanup(): Promise<void> {
  await deleteExpiredExportCache();
  await orphanedScreenshotCleanup();
  
  const quota = await checkStorageQuota();
  
  if (quota.percentUsed > 80) {
    const db = getDb();
    const threshold = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days
    
    const oldSyncedNotes = await db.notes
      .filter(n => n.syncStatus === 'synced' && n.lastModified < threshold)
      .toArray();
      
    const uuidsToDelete = oldSyncedNotes.map(n => n.uuid);
    
    if (uuidsToDelete.length > 0) {
      await db.transaction('rw', [db.screenshots], async () => {
        await db.screenshots.bulkDelete(uuidsToDelete);
      });
    }
    
    await checkStorageQuota();
  }
}
