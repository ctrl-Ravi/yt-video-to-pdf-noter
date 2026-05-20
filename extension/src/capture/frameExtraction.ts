import { compressImage, CompressionResult } from '../workers/compressionClient';

export async function extractFrame(video: HTMLVideoElement): Promise<CompressionResult> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error('Video dimensions are 0');
  }

  const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context for OffscreenCanvas');

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const arrayBuffer = await blob.arrayBuffer();

  return compressImage(arrayBuffer, canvas.width, canvas.height);
}
