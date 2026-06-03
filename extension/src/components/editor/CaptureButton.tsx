import React, { useCallback, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
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

interface CaptureButtonProps {
  /** Extra classes forwarded to the Button wrapper */
  className?: string;
  size?: React.ComponentProps<typeof Button>['size'];
}

export function CaptureButton({ className, size = 'sm' }: CaptureButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const { setPendingCapture } = useSidebarStore();

  const handleCapture = useCallback(async () => {
    if (isCapturing) return;

    const platform = getPlatform();
    const video = platform.getVideoElement();
    if (!video) {
      console.warn('CaptureButton: no video element found');
      return;
    }

    setIsCapturing(true);
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
      console.error('CaptureButton: capture failed', err);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, setPendingCapture]);

  return (
    <Button
      size={size}
      variant="outline"
      className={cn('gap-1.5', className)}
      onClick={handleCapture}
      disabled={isCapturing}
      title="Capture screenshot from video"
    >
      {isCapturing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Camera className="h-3.5 w-3.5" />
      )}
      {isCapturing ? 'Capturing…' : 'Capture'}
    </Button>
  );
}
