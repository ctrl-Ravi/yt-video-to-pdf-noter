import { describe, it, expect } from 'vitest';
import { getDb, orphanedScreenshotCleanup, writeThumbnail, readThumbnail, writeScreenshot, readScreenshot, writeExportCache, readExportCache, deleteExpiredExportCache, createNote } from '../index';
import { NoteProject } from '@yt-noter-pro/shared-types';

describe('Storage Operations', () => {
  it('Orphaned screenshot cleanup deletes entries for non-existent note UUIDs', async () => {
    await writeThumbnail('ghost', new Blob(['thumb']));
    await writeScreenshot('ghost', new Blob(['screen']));
    
    const note: NoteProject = {
      uuid: 'valid',
      version: 1,
      syncStatus: 'local-only',
      captureMethod: 'none',
      notebookUuid: 'nb-1',
      studySessionUuid: null,
      title: 'Valid Note',
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
    await writeThumbnail('valid', new Blob(['valid-thumb']));
    
    await orphanedScreenshotCleanup();
    
    const ghostThumb = await readThumbnail('ghost');
    expect(ghostThumb).toBeUndefined();
    const ghostScreen = await readScreenshot('ghost');
    expect(ghostScreen).toBeUndefined();
    
    const validThumb = await readThumbnail('valid');
    expect(validThumb).toBeDefined();
  });
  
  it('Export cache TTL cleanup deletes entries > 24h; keeps entries < 24h', async () => {
    const db = getDb();
    
    await db.exportCache.put({
      noteUuid: 'old',
      exportType: 'pdf',
      generatedAt: Date.now() - (48 * 60 * 60 * 1000), // 48h ago
      data: new Blob(['old'])
    });
    
    await writeExportCache('new', 'pdf', new Blob(['new']));
    
    await deleteExpiredExportCache();
    
    const oldCache = await readExportCache('old', 'pdf');
    expect(oldCache).toBeUndefined();
    
    const newCache = await readExportCache('new', 'pdf');
    expect(newCache).toBeDefined();
  });
});
