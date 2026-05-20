import { GenericPlatform } from './generic';

const YOUTUBE_PLAYER_SELECTOR = 'video.html5-main-video';
const YT_TITLE_SELECTOR = 'h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata';

export class YouTubePlatform extends GenericPlatform {
  getVideoElement(): HTMLVideoElement | null {
    const genericVideo = super.getVideoElement();
    if (genericVideo) return genericVideo;

    return document.querySelector<HTMLVideoElement>(YOUTUBE_PLAYER_SELECTOR);
  }

  getVideoTitle(): string {
    const titleEl = document.querySelector(YT_TITLE_SELECTOR);
    if (titleEl && titleEl.textContent) {
      return titleEl.textContent.trim();
    }
    return document.title.replace(/ - YouTube$/, '');
  }

  getPlatformIdentifier(): string {
    return 'youtube';
  }

  onNavigate(callback: () => void): void {
    super.onNavigate(callback);
    window.addEventListener('yt-navigate-finish', () => {
      callback();
    });
  }
}
