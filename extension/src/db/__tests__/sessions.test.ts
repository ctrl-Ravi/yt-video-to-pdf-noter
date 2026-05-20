import { describe, it, expect } from 'vitest';
import { getDb, createNote, createSession } from '../index';
import { StudySession, NoteProject } from '@yt-noter-pro/shared-types';

describe('Study Sessions Operations', () => {
  it('Creating note with session UUID updates session\'s noteUuids array', async () => {
    const db = getDb();
    const session: StudySession = {
      uuid: 'session-1',
      title: 'Math Study',
      videoUrl: 'https://yt.com/math',
      videoTitle: 'Math Video',
      status: 'active',
      startTimestamp: Date.now(),
      endTimestamp: null,
      noteUuids: []
    };
    
    await createSession(session);
    
    const note: NoteProject = {
      uuid: 'note-math',
      version: 1,
      syncStatus: 'local-only',
      captureMethod: 'none',
      notebookUuid: 'nb-1',
      studySessionUuid: 'session-1',
      title: 'Math Note',
      body: 'Calculus',
      createdAt: Date.now(),
      lastModified: Date.now(),
      isDeleted: false,
      platformIdentifier: 'yt',
      videoUrl: 'https://yt.com/math',
      videoTitle: 'Math Video',
      timestampString: '01:00',
      timestampSeconds: 60,
      displayOrder: 1,
      screenshot: { tier2Key: null, tier3Key: null, width: null, height: null, uncompressed: false },
      annotations: []
    };
    
    await createNote(note);
    
    const updatedSession = await db.studySessions.get('session-1');
    expect(updatedSession?.noteUuids).toContain('note-math');
  });
});
