import { describe, it, expect } from 'vitest';
import { getDb, createNote, updateNoteText, softDeleteNote, hardDeleteNote, getNoteById, writeThumbnail, writeScreenshot, readThumbnail, readScreenshot, searchNotes, writeExportCache, readExportCache } from '../index';
import { NoteProject } from '@yt-noter-pro/shared-types';

const mockNote = (): NoteProject => ({
  uuid: 'note-1',
  version: 1,
  syncStatus: 'local-only',
  captureMethod: 'none',
  notebookUuid: 'nb-1',
  studySessionUuid: null,
  title: 'Test Note',
  body: 'Hello World',
  createdAt: Date.now(),
  lastModified: Date.now(),
  isDeleted: false,
  platformIdentifier: 'yt',
  videoUrl: 'https://yt.com/123',
  videoTitle: 'Test Video',
  timestampString: '01:00',
  timestampSeconds: 60,
  displayOrder: 1,
  screenshot: { tier2Key: null, tier3Key: null, width: null, height: null, uncompressed: false },
  annotations: []
});

describe('Notes Operations', () => {
  it('Creating a note writes correct fields to all tables', async () => {
    const note = mockNote();
    await createNote(note);
    await writeThumbnail(note.uuid, new Blob(['thumb']));
    await writeScreenshot(note.uuid, new Blob(['full']));
    
    const dbNote = await getNoteById('note-1');
    expect(dbNote).toBeDefined();
    expect(dbNote?.title).toBe('Test Note');
    
    const searchMatches = await searchNotes('Hello');
    expect(searchMatches).toContain('note-1');
    
    const searchNonMatches = await searchNotes('Goodbye');
    expect(searchNonMatches).not.toContain('note-1');
    
    const thumb = await readThumbnail('note-1');
    expect(thumb).toBeDefined();
    
    const screenshot = await readScreenshot('note-1');
    expect(screenshot).toBeDefined();
  });
  
  it('Updating note text increments version, updates lastModified, updates search index, invalidates export cache', async () => {
    const note = mockNote();
    await createNote(note);
    const initialMod = note.lastModified;
    
    await writeExportCache(note.uuid, 'pdf', new Blob(['cache']));
    
    await new Promise(r => setTimeout(r, 10)); // let time pass
    await updateNoteText(note.uuid, 'New Title', 'New Body');
    
    const dbNote = await getNoteById(note.uuid);
    expect(dbNote?.version).toBe(2);
    expect(dbNote!.lastModified).toBeGreaterThan(initialMod);
    expect(dbNote?.title).toBe('New Title');
    
    const searchMatches = await searchNotes('New Body');
    expect(searchMatches).toContain(note.uuid);
    
    const oldMatches = await searchNotes('Hello');
    expect(oldMatches).not.toContain(note.uuid);
    
    const cache = await readExportCache(note.uuid, 'pdf');
    expect(cache).toBeUndefined();
  });
  
  it('Soft-delete sets deleted flag, updates lastModified, removes search entry, keeps image tiers', async () => {
    const note = mockNote();
    await createNote(note);
    await writeThumbnail(note.uuid, new Blob(['thumb']));
    
    await softDeleteNote(note.uuid);
    
    const dbNote = await getNoteById(note.uuid);
    expect(dbNote?.isDeleted).toBe(true);
    
    const searchMatches = await searchNotes('Hello');
    expect(searchMatches).not.toContain(note.uuid);
    
    const thumb = await readThumbnail(note.uuid);
    expect(thumb).toBeDefined();
  });
  
  it('Hard-delete removes note, thumbnail, screenshot, and search index entry', async () => {
    const note = mockNote();
    await createNote(note);
    await writeThumbnail(note.uuid, new Blob(['thumb']));
    await writeScreenshot(note.uuid, new Blob(['full']));
    
    await hardDeleteNote(note.uuid);
    
    const dbNote = await getNoteById(note.uuid);
    expect(dbNote).toBeUndefined();
    
    const searchMatches = await searchNotes('Hello');
    expect(searchMatches).not.toContain(note.uuid);
    
    const thumb = await readThumbnail(note.uuid);
    expect(thumb).toBeUndefined();
    
    const screen = await readScreenshot(note.uuid);
    expect(screen).toBeUndefined();
  });
});
