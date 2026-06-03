import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X, Save, Check } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { cn } from '@/src/lib/utils';
import { useSidebarStore } from '@/src/store/sidebar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface NoteEditorValue {
  title: string;
  body: string;
  /** Compressed screenshot blob ready to be stored, or null if none captured */
  screenshotBlob: Blob | null;
}

interface NoteEditorProps {
  /** Initial values – pass undefined for a blank new note */
  initialTitle?: string;
  initialBody?: string;
  /** Pre-captured screenshot blob (e.g. from auto-snap) */
  pendingScreenshot?: Blob | null;
  /** Timestamp string shown in the preview, e.g. "3:42" */
  timestampLabel?: string;
  /** Called when the user clicks Save */
  onSave: (value: NoteEditorValue) => void;
  /** Called when the user clicks Capture Screenshot */
  onCaptureRequest: () => void;
  /** Whether a capture is currently in progress */
  isCapturing?: boolean;
}

// ---------------------------------------------------------------------------
// Auto-resize helper – grows textarea to fit content
// ---------------------------------------------------------------------------
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function NoteEditor({
  initialTitle = '',
  initialBody = '',
  pendingScreenshot = null,
  timestampLabel,
  onSave,
  onCaptureRequest,
  isCapturing = false,
}: NoteEditorProps) {
  const { autoSnapEnabled } = useSidebarStore();

  // Title is controlled – it's short and low-frequency
  const [title, setTitle] = useState(initialTitle);

  // Body is uncontrolled to avoid keystroke lag; we only read via ref on blur/save
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Pending screenshot state – parent can inject via prop, user can clear it
  const [screenshot, setScreenshot] = useState<Blob | null>(pendingScreenshot);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  // Track whether note was just saved (for transient ✓ feedback)
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync prop → state when parent pushes a new screenshot (e.g. auto-snap)
  useEffect(() => {
    setScreenshot(pendingScreenshot ?? null);
  }, [pendingScreenshot]);

  // Manage blob URL lifecycle
  useEffect(() => {
    if (!screenshot) {
      setScreenshotUrl(null);
      return;
    }
    const url = URL.createObjectURL(screenshot);
    setScreenshotUrl(url);
    return () => URL.revokeObjectURL(url);   // always revoke on cleanup
  }, [screenshot]);

  // Auto-resize on initial render if body has content
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.value = initialBody;
      autoResize(bodyRef.current);
    }
  }, [initialBody]);

  // Cleanup saved timer on unmount
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleSave = useCallback(() => {
    onSave({
      title: title.trim(),
      body: bodyRef.current?.value.trim() ?? '',
      screenshotBlob: screenshot,
    });

    // Brief ✓ feedback
    setJustSaved(true);
    savedTimerRef.current = setTimeout(() => setJustSaved(false), 1500);
  }, [title, screenshot, onSave]);

  const handleClearScreenshot = useCallback(() => {
    setScreenshot(null);
  }, []);

  return (
    <div className="flex flex-col gap-0 w-full">
      {/* ---- Screenshot preview ---- */}
      {screenshotUrl && (
        <div className="relative group mx-3 mt-3">
          <img
            src={screenshotUrl}
            alt="Screenshot preview"
            className="w-full rounded-md border object-cover max-h-36"
          />
          {/* Timestamp badge */}
          {timestampLabel && (
            <span className="absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-mono bg-black/60 text-white">
              {timestampLabel}
            </span>
          )}
          {/* Clear button */}
          <button
            onClick={handleClearScreenshot}
            title="Remove screenshot"
            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ---- Title ---- */}
      <input
        type="text"
        placeholder="Note title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={cn(
          'w-full bg-transparent px-3 pt-3 pb-1 text-sm font-medium',
          'border-b border-border/60 focus:border-primary focus:outline-none',
          'placeholder:text-muted-foreground/50 text-foreground'
        )}
      />

      {/* ---- Body ---- */}
      <textarea
        ref={bodyRef}
        placeholder="Start writing your note…"
        rows={3}
        onInput={(e) => autoResize(e.currentTarget)}
        className={cn(
          'w-full resize-none bg-transparent px-3 py-2 text-sm',
          'focus:outline-none text-foreground placeholder:text-muted-foreground/50',
          'min-h-[72px]'
        )}
      />

      {/* ---- Action row ---- */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-1">
        {/* Save button */}
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5 flex-1"
          onClick={handleSave}
        >
          {justSaved ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              Save Note
            </>
          )}
        </Button>

        {/* Capture button */}
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5"
          onClick={onCaptureRequest}
          disabled={isCapturing}
          title="Capture screenshot from video"
        >
          <Camera className={cn('h-3.5 w-3.5', isCapturing && 'animate-pulse')} />
          {isCapturing ? 'Capturing…' : 'Capture'}
        </Button>

        {/* Auto-snap indicator */}
        <span
          title={autoSnapEnabled ? 'Auto-snap is on' : 'Auto-snap is off'}
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors',
            autoSnapEnabled
              ? 'border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400'
              : 'border-border bg-muted text-muted-foreground'
          )}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              autoSnapEnabled ? 'bg-green-500' : 'bg-muted-foreground/40'
            )}
          />
        </span>
      </div>
    </div>
  );
}
