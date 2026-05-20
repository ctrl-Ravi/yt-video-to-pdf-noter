import { extractFrame } from './frameExtraction';
import { tabCaptureFallback, UserDeclinedError } from './tabCapture';
import { CompressionResult } from '../workers/compressionClient';

export { UserDeclinedError } from './tabCapture';
export { setupTabCaptureHandler } from './backgroundHandler';

export interface FinalCaptureResult extends CompressionResult {
  method: 'frame-extraction' | 'tab-capture';
}

export async function captureFrame(video: HTMLVideoElement): Promise<FinalCaptureResult> {
  try {
    const result = await extractFrame(video);
    return { ...result, method: 'frame-extraction' };
  } catch (error: any) {
    console.warn('Frame extraction failed, falling back to tab capture:', error);
    if (error.name === 'SecurityError' || error.message?.toLowerCase().includes('cross-origin')) {
      // Expected for DRM
    }
    const result = await tabCaptureFallback(video);
    return { ...result, method: 'tab-capture' };
  }
}
