import { createRoot } from 'react-dom/client';
import React from 'react';
import { PermissionPrompt } from './permissionPrompt';
import { compressImage, CompressionResult } from '../workers/compressionClient';

export class UserDeclinedError extends Error {
  constructor(message = 'User declined tab capture permission') {
    super(message);
    this.name = 'UserDeclinedError';
  }
}

let hasRequestedPermission = false;
let permissionGranted = false;

async function requestTabCapturePermission(): Promise<boolean> {
  if (hasRequestedPermission) return permissionGranted;
  
  return new Promise((resolve) => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '2147483647';
    document.body.appendChild(container);

    const root = createRoot(container);

    const cleanup = (granted: boolean) => {
      hasRequestedPermission = true;
      permissionGranted = granted;
      root.unmount();
      container.remove();
      resolve(granted);
    };

    root.render(
      React.createElement(PermissionPrompt, {
        onAllow: () => cleanup(true),
        onDecline: () => cleanup(false)
      })
    );
  });
}

export async function tabCaptureFallback(video: HTMLVideoElement): Promise<CompressionResult> {
  const granted = await requestTabCapturePermission();
  if (!granted) {
    throw new UserDeclinedError();
  }

  const response = await chrome.runtime.sendMessage({ type: 'TAB_CAPTURE_REQUEST' });
  if (!response || response.error) {
    throw new Error(response?.error || 'Tab capture failed');
  }

  const dataUrl = response.dataUrl;
  
  const img = await createImageBitmap(await (await fetch(dataUrl)).blob());
  
  const rect = video.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  const cropX = Math.max(0, rect.left * dpr);
  const cropY = Math.max(0, rect.top * dpr);
  const cropW = Math.min(rect.width * dpr, img.width - cropX);
  const cropH = Math.min(rect.height * dpr, img.height - cropY);

  if (cropW <= 0 || cropH <= 0) {
    throw new Error('Video is not visible on screen for tab capture');
  }

  const canvas = new OffscreenCanvas(cropW, cropH);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context for OffscreenCanvas');

  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const arrayBuffer = await blob.arrayBuffer();

  return compressImage(arrayBuffer, cropW, cropH);
}
