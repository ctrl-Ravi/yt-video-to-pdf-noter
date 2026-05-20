import { getDb } from '../database';

export async function writeExportCache(noteUuid: string, exportType: string, data: Blob): Promise<void> {
  const db = getDb();
  await db.exportCache.put({ noteUuid, exportType, generatedAt: Date.now(), data });
}

export async function readExportCache(noteUuid: string, exportType: string): Promise<Blob | undefined> {
  const db = getDb();
  const entry = await db.exportCache.get([noteUuid, exportType]);
  return entry?.data as Blob | undefined;
}

export async function deleteExpiredExportCache(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
  const db = getDb();
  const threshold = Date.now() - maxAgeMs;
  await db.exportCache.where('generatedAt').below(threshold).delete();
}
