import { getDb } from '../database';
import { Notebook } from '@yt-noter-pro/shared-types';

export async function createNotebook(notebook: Notebook): Promise<void> {
  const db = getDb();
  await db.notebooks.put(notebook);
}

export async function getAllNotebooks(): Promise<Notebook[]> {
  const db = getDb();
  return db.notebooks.orderBy('displayOrder').toArray();
}

export async function renameNotebook(uuid: string, newName: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.notebooks, db.notes, db.exportCache], async () => {
    const notebook = await db.notebooks.get(uuid);
    if (!notebook) return;
    
    notebook.name = newName;
    notebook.lastModified = Date.now();
    await db.notebooks.put(notebook);
    
    const notesInNb = await db.notes.where({ notebookUuid: uuid }).toArray();
    for (const note of notesInNb) {
      note.version += 1;
      note.lastModified = Date.now();
      await db.notes.put(note);
      await db.exportCache.where({ noteUuid: note.uuid }).delete();
    }
  });
}

export async function deleteNotebook(uuid: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.notebooks, db.notes, db.searchIndex, db.exportCache], async () => {
    const notesInNb = await db.notes.where({ notebookUuid: uuid }).toArray();
    for (const note of notesInNb) {
      note.isDeleted = true;
      note.version += 1;
      note.lastModified = Date.now();
      await db.notes.put(note);
      await db.searchIndex.delete(note.uuid);
      await db.exportCache.where({ noteUuid: note.uuid }).delete();
    }
    
    const notebook = await db.notebooks.get(uuid);
    if (notebook) {
      notebook.isDeleted = true;
      notebook.lastModified = Date.now();
      await db.notebooks.put(notebook);
    }
  });
}
