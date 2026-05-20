import { FinalCaptureResult } from '../capture';

export interface Platform {
  detectVideo(): boolean;
  getVideoElement(): HTMLVideoElement | null;
  getCurrentTimestamp(): number;
  getVideoTitle(): string;
  getPlatformIdentifier(): string;
  captureFrame(): Promise<FinalCaptureResult>;
  onNavigate(callback: () => void): void;
}
