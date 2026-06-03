import { useEffect, useRef } from 'react';
import { getPlatform } from '@/src/platform/detector';
import { useSidebarStore, PendingCapture } from '@/src/store/sidebar';

/**
 * Formats seconds → "m:ss" (e.g. 222 → "3:42")
 */
function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * useAutoSnap
 *
 * Attaches a `pause` event listener to the platform's video element.
 * When the video pauses and `autoSnapEnabled` is true, it calls
 * `platform.captureFrame()` and stores the result as `pendingCapture`
 * in the Zustand store, replacing any previous pending capture.
 *
 * - Safe to mount multiple times (idempotent via ref guard).
 * - Cleans up the event listener on unmount or when the video element changes.
 */
export function useAutoSnap() {
  const { autoSnapEnabled, setPendingCapture } = useSidebarStore();

  // Keep a stable reference so the event handler always reads the latest value
  // without needing to re-attach the listener on every toggle.
  const autoSnapRef = useRef(autoSnapEnabled);
  useEffect(() => {
    autoSnapRef.current = autoSnapEnabled;
  }, [autoSnapEnabled]);

  // Track whether a capture is already in flight to prevent concurrent captures
  const isCapturingRef = useRef(false);

  useEffect(() => {
    const platform = getPlatform();
    const video = platform.getVideoElement();

    if (!video) {
      // Video may not be available yet – the platform's onNavigate will
      // eventually reload the content script so we just bail gracefully.
      return;
    }

    const handlePause = async () => {
      if (!autoSnapRef.current) return;
      if (isCapturingRef.current) return;

      isCapturingRef.current = true;
      try {
        const timestampSeconds = platform.getCurrentTimestamp();
        const result = await platform.captureFrame();

        const capture: PendingCapture = {
          result,
          timestampSeconds,
          timestampLabel: formatTimestamp(timestampSeconds),
        };
        setPendingCapture(capture);
      } catch (err) {
        // DRM or permission errors are expected – log but don't crash.
        console.warn('useAutoSnap: captureFrame failed on pause', err);
      } finally {
        isCapturingRef.current = false;
      }
    };

    video.addEventListener('pause', handlePause);
    return () => video.removeEventListener('pause', handlePause);
    // Re-run only if the video element identity changes (navigation).
    // autoSnapEnabled changes are handled via ref to avoid re-attaching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setPendingCapture]);
}
