import { getDb } from '../database';
import { StudySession, NoteProject } from '@yt-noter-pro/shared-types';

export async function createSession(session: StudySession): Promise<void> {
  const db = getDb();
  await db.studySessions.put(session);
}

export async function updateSessionEnd(uuid: string, endTimestamp: number): Promise<void> {
  const db = getDb();
  await db.studySessions.update(uuid, { endTimestamp });
}

export async function completeSession(uuid: string): Promise<void> {
  const db = getDb();
  await db.studySessions.update(uuid, { status: 'completed', endTimestamp: Date.now() });
}

export async function getActiveSessionForVideo(videoUrl: string): Promise<StudySession | undefined> {
  const db = getDb();
  return db.studySessions.where({ videoUrl, status: 'active' }).first();
}

export async function getAllSessions(): Promise<StudySession[]> {
  const db = getDb();
  return db.studySessions.orderBy('startTimestamp').reverse().toArray();
}

export async function getSessionNotes(sessionUuid: string): Promise<NoteProject[]> {
  const db = getDb();
  return db.notes.where({ studySessionUuid: sessionUuid }).sortBy('displayOrder');
}
