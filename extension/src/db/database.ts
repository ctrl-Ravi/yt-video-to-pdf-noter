import Dexie, { Table } from 'dexie';
import {
  NoteProject,
  Notebook,
  StudySession,
  SyncQueueEntry,
  SearchIndexEntry,
  LocalPreferences
} from '@yt-noter-pro/shared-types';

export interface ThumbnailEntry {
  noteUuid: string;
  data: Blob;
}

export interface ScreenshotEntry {
  noteUuid: string;
  data: Blob;
}

export interface ExportCacheEntry {
  noteUuid: string;
  exportType: string;
  generatedAt: number;
  data: Blob;
}

export class YtNoterDatabase extends Dexie {
  notes!: Table<NoteProject, string>;
  notebooks!: Table<Notebook, string>;
  studySessions!: Table<StudySession, string>;
  thumbnails!: Table<ThumbnailEntry, string>;
  screenshots!: Table<ScreenshotEntry, string>;
  syncQueue!: Table<SyncQueueEntry, string>;
  searchIndex!: Table<SearchIndexEntry, string>;
  preferences!: Table<LocalPreferences, string>;
  exportCache!: Table<ExportCacheEntry, [string, string]>;

  constructor() {
    super('YtNoterDatabase');
    
    this.version(1).stores({
      notes: '&uuid, notebookUuid, studySessionUuid, videoUrl, lastModified, syncStatus, isDeleted',
      notebooks: '&uuid',
      studySessions: '&uuid, videoUrl, status',
      thumbnails: '&noteUuid',
      screenshots: '&noteUuid',
      syncQueue: '&uuid, targetProvider, noteUuid, nextRetryTimestamp',
      searchIndex: '&noteUuid',
      preferences: '&key',
      exportCache: '[noteUuid+exportType], generatedAt'
    });
  }
}

let dbInstance: YtNoterDatabase | null = null;

export function getDb(): YtNoterDatabase {
  if (!dbInstance) {
    dbInstance = new YtNoterDatabase();
  }
  return dbInstance;
}
