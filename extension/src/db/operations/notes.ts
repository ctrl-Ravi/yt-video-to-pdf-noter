import { getDb } from '../database';
import { NoteProject, Annotation, SyncStatus } from '@yt-noter-pro/shared-types';

export async function createNote(note: NoteProject): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.notes, db.searchIndex, db.studySessions], async () => {
    await db.notes.put(note);
    await db.searchIndex.put({
      noteUuid: note.uuid,
      title: note.title,
      body: note.body,
      videoTitle: note.videoTitle,
      tags: []
    });
    
    if (note.studySessionUuid) {
      const session = await db.studySessions.get(note.studySessionUuid);
      if (session && !session.noteUuids.includes(note.uuid)) {
        session.noteUuids.push(note.uuid);
        await db.studySessions.put(session);
      }
    }
  });
}

export async function getNoteById(uuid: string): Promise<NoteProject | undefined> {
  const db = getDb();
  return db.notes.get(uuid);
}

export async function getNotesByNotebook(notebookUuid: string): Promise<NoteProject[]> {
  const db = getDb();
  return db.notes.where({ notebookUuid }).sortBy('displayOrder');
}

export async function getNotesByVideoUrl(videoUrl: string): Promise<NoteProject[]> {
  const db = getDb();
  return db.notes.where({ videoUrl }).sortBy('timestampSeconds');
}

export async function getNotesModifiedAfter(timestamp: number): Promise<NoteProject[]> {
  const db = getDb();
  return db.notes.where('lastModified').above(timestamp).toArray();
}

export async function updateNoteText(uuid: string, title: string, body: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.notes, db.searchIndex, db.exportCache], async () => {
    const note = await db.notes.get(uuid);
    if (!note) return;
    
    note.title = title;
    note.body = body;
    note.version += 1;
    note.lastModified = Date.now();
    
    await db.notes.put(note);
    await db.searchIndex.update(uuid, { title, body });
    await db.exportCache.where({ noteUuid: uuid }).delete();
  });
}

export async function updateNoteAnnotations(uuid: string, annotations: Annotation[]): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.notes, db.exportCache], async () => {
    const note = await db.notes.get(uuid);
    if (!note) return;
    
    note.annotations = annotations;
    note.version += 1;
    note.lastModified = Date.now();
    
    await db.notes.put(note);
    await db.exportCache.where({ noteUuid: uuid }).delete();
  });
}

export async function updateNoteSyncStatus(uuid: string, syncStatus: SyncStatus): Promise<void> {
  const db = getDb();
  await db.notes.update(uuid, { syncStatus });
}

export async function softDeleteNote(uuid: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.notes, db.searchIndex, db.exportCache], async () => {
    const note = await db.notes.get(uuid);
    if (!note) return;
    
    note.isDeleted = true;
    note.version += 1;
    note.lastModified = Date.now();
    
    await db.notes.put(note);
    await db.searchIndex.delete(uuid);
    await db.exportCache.where({ noteUuid: uuid }).delete();
  });
}

export async function hardDeleteNote(uuid: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.notes, db.searchIndex, db.thumbnails, db.screenshots, db.exportCache, db.studySessions], async () => {
    const note = await db.notes.get(uuid);
    if (note && note.studySessionUuid) {
      const session = await db.studySessions.get(note.studySessionUuid);
      if (session) {
        session.noteUuids = session.noteUuids.filter(id => id !== uuid);
        await db.studySessions.put(session);
      }
    }
    
    await db.notes.delete(uuid);
    await db.searchIndex.delete(uuid);
    await db.thumbnails.delete(uuid);
    await db.screenshots.delete(uuid);
    await db.exportCache.where({ noteUuid: uuid }).delete();
  });
}

export async function getPendingSyncNotes(): Promise<NoteProject[]> {
  const db = getDb();
  return db.notes.where({ syncStatus: 'pending-sync' }).toArray();
}
