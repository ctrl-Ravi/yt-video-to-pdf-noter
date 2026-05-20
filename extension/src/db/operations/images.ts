import { getDb } from '../database';

export async function writeThumbnail(noteUuid: string, data: Blob): Promise<void> {
  const db = getDb();
  await db.thumbnails.put({ noteUuid, data });
}

export async function readThumbnail(noteUuid: string): Promise<Blob | undefined> {
  const db = getDb();
  const entry = await db.thumbnails.get(noteUuid);
  return entry?.data;
}

export async function writeScreenshot(noteUuid: string, data: Blob): Promise<void> {
  const db = getDb();
  await db.screenshots.put({ noteUuid, data });
}

export async function readScreenshot(noteUuid: string): Promise<Blob | undefined> {
  const db = getDb();
  const entry = await db.screenshots.get(noteUuid);
  return entry?.data;
}

export async function deleteImageTiers(noteUuid: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.thumbnails, db.screenshots], async () => {
    await db.thumbnails.delete(noteUuid);
    await db.screenshots.delete(noteUuid);
  });
}
