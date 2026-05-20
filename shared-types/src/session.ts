export type StudySessionStatus = 'active' | 'completed';

export interface StudySession {
  uuid: string;
  title: string;
  videoUrl: string;
  videoTitle: string;
  status: StudySessionStatus;
  startTimestamp: number;
  endTimestamp: number | null;
  noteUuids: string[];
}
