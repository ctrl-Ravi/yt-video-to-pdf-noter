import { Platform } from './types';
import { captureFrame, FinalCaptureResult } from '../capture';

export function findMostVisibleVideo(videos: HTMLVideoElement[]): HTMLVideoElement | null {
  if (videos.length === 0) return null;

  let mostVisible: HTMLVideoElement | null = null;
  let maxFraction = 0;
  
  for (const v of videos) {
    const rect = v.getBoundingClientRect();
    const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    const visibleArea = visibleWidth * visibleHeight;
    const totalArea = rect.width * rect.height;
    if (totalArea === 0) continue;
    
    const fraction = visibleArea / totalArea;
    if (fraction > maxFraction) {
      maxFraction = fraction;
      mostVisible = v;
    }
  }

  return mostVisible || videos[0] || null;
}

export class GenericPlatform implements Platform {
  detectVideo(): boolean {
    return this.getVideoElement() !== null;
  }

  getVideoElement(): HTMLVideoElement | null {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;

    const playing = videos.find(v => !v.paused && !v.ended && v.readyState > 2);
    if (playing) return playing;

    return findMostVisibleVideo(videos);
  }

  getCurrentTimestamp(): number {
    const video = this.getVideoElement();
    return video ? video.currentTime : 0;
  }

  getVideoTitle(): string {
    return document.title;
  }

  getPlatformIdentifier(): string {
    return 'generic';
  }

  async captureFrame(): Promise<FinalCaptureResult> {
    const video = this.getVideoElement();
    if (!video) throw new Error('No video element found for capture');
    return captureFrame(video);
  }

  onNavigate(callback: () => void): void {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      const result = originalPushState.apply(this, args);
      callback();
      return result;
    };

    history.replaceState = function(...args) {
      const result = originalReplaceState.apply(this, args);
      callback();
      return result;
    };

    window.addEventListener('popstate', () => {
      callback();
    });
  }
}
