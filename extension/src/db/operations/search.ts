import { getDb } from '../database';
import { SearchIndexEntry } from '@yt-noter-pro/shared-types';

export async function writeSearchEntry(entry: SearchIndexEntry): Promise<void> {
  const db = getDb();
  await db.searchIndex.put(entry);
}

export async function deleteSearchEntry(noteUuid: string): Promise<void> {
  const db = getDb();
  await db.searchIndex.delete(noteUuid);
}

export async function searchNotes(query: string): Promise<string[]> {
  const db = getDb();
  const lowerQuery = query.toLowerCase();
  const matches = await db.searchIndex.filter(entry => 
    entry.title.toLowerCase().includes(lowerQuery) || 
    entry.body.toLowerCase().includes(lowerQuery)
  ).toArray();
  return matches.map(m => m.noteUuid);
}
