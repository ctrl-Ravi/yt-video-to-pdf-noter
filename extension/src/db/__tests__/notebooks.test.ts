import { describe, it, expect } from 'vitest';
import { getDb, createNotebook, renameNotebook, createNote } from '../index';
import { Notebook, NoteProject } from '@yt-noter-pro/shared-types';

describe('Notebooks Operations', () => {
  it('Notebook creation and note assignment; renameNotebook updates all notes', async () => {
    const nb: Notebook = {
      uuid: 'nb-1',
      name: 'Old Name',
      displayOrder: 1,
      createdAt: Date.now(),
      lastModified: Date.now(),
      isDeleted: false
    };
    
    await createNotebook(nb);
    
    const note: NoteProject = {
      uuid: 'note-nb',
      version: 1,
      syncStatus: 'local-only',
      captureMethod: 'none',
      notebookUuid: 'nb-1',
      studySessionUuid: null,
      title: 'Nb Note',
      body: 'Content',
      createdAt: Date.now(),
      lastModified: Date.now(),
      isDeleted: false,
      platformIdentifier: 'yt',
      videoUrl: 'https://yt.com/123',
      videoTitle: 'Video',
      timestampString: '01:00',
      timestampSeconds: 60,
      displayOrder: 1,
      screenshot: { tier2Key: null, tier3Key: null, width: null, height: null, uncompressed: false },
      annotations: []
    };
    
    await createNote(note);
    const initialMod = note.lastModified;
    
    await new Promise(r => setTimeout(r, 10));
    await renameNotebook('nb-1', 'New Name');
    
    const db = getDb();
    const dbNb = await db.notebooks.get('nb-1');
    expect(dbNb?.name).toBe('New Name');
    
    const dbNote = await db.notes.get('note-nb');
    expect(dbNote?.version).toBe(2);
    expect(dbNote!.lastModified).toBeGreaterThan(initialMod);
  });
});
