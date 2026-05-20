import { SyncStatus } from './sync';

export type CaptureMethod = 'frame-extraction' | 'tab-capture' | 'none';

export interface AnnotationPoint {
  x: number; // 0..1
  y: number; // 0..1
}

export interface FreehandAnnotation {
  uuid: string;
  type: 'freehand';
  points: AnnotationPoint[];
  color: string;
  thickness: number;
  isDeleted: boolean;
}

export interface RectangleAnnotation {
  uuid: string;
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  thickness: number;
  isDeleted: boolean;
}

export interface CircleAnnotation {
  uuid: string;
  type: 'circle';
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  color: string;
  thickness: number;
  isDeleted: boolean;
}

export interface TextAnnotation {
  uuid: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  isDeleted: boolean;
}

export interface HighlightAnnotation {
  uuid: string;
  type: 'highlight';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  isDeleted: boolean;
}

export type Annotation = 
  | FreehandAnnotation 
  | RectangleAnnotation 
  | CircleAnnotation 
  | TextAnnotation 
  | HighlightAnnotation;

export interface ScreenshotData {
  tier2Key: string | null;
  tier3Key: string | null;
  width: number | null;
  height: number | null;
  uncompressed: boolean;
}

export interface NoteProject {
  uuid: string;
  version: number;
  syncStatus: SyncStatus;
  captureMethod: CaptureMethod;
  notebookUuid: string;
  studySessionUuid: string | null;
  title: string;
  body: string;
  createdAt: number;
  lastModified: number;
  isDeleted: boolean;
  platformIdentifier: string;
  videoUrl: string;
  videoTitle: string;
  timestampString: string;
  timestampSeconds: number;
  displayOrder: number;
  screenshot: ScreenshotData;
  annotations: Annotation[];
}
