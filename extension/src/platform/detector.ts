import { Platform } from './types';
import { YouTubePlatform } from './youtube';
import { GenericPlatform } from './generic';

let currentPlatform: Platform | null = null;

export function detectPlatform(): Platform {
  if (currentPlatform) return currentPlatform;

  const hostname = window.location.hostname;
  if (hostname === 'youtube.com' || hostname === 'www.youtube.com') {
    currentPlatform = new YouTubePlatform();
  } else {
    currentPlatform = new GenericPlatform();
  }

  return currentPlatform;
}

export function getPlatform(): Platform {
  if (!currentPlatform) {
    return detectPlatform();
  }
  return currentPlatform;
}
