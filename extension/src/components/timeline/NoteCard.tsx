import React, { useEffect, useRef, useState } from 'react';
import { Trash2, ExternalLink, Clock } from 'lucide-react';
import { NoteProject } from '@yt-noter-pro/shared-types';
import { getDb } from '@/src/db/database';
import { softDeleteNote } from '@/src/db/operations/notes';
import { cn } from '@/src/lib/utils';

interface NoteCardProps {
  note: NoteProject;
  /** Estimated row height – used externally by the virtualizer, stored here for reference */
  estimatedHeight: number;
}

/**
 * Async thumbnail loader with Blob URL lifecycle management.
 * Returns the object URL (or null while loading / if no thumbnail).
 */
function useThumbnailUrl(noteUuid: string, hasThumbnail: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasThumbnail) return;

    let cancelled = false;

    (async () => {
      try {
        const db = getDb();
        const entry = await db.thumbnails.get(noteUuid);
        if (cancelled || !entry) return;

        const objectUrl = URL.createObjectURL(entry.data);
        urlRef.current = objectUrl;
        setUrl(objectUrl);
      } catch {
        // Thumbnail may not exist yet or DB may be unavailable – silently ignore
      }
    })();

    return () => {
      cancelled = true;
      // Revoke on unmount to prevent memory leaks
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [noteUuid, hasThumbnail]);

  return url;
}

export function NoteCard({ note }: NoteCardProps) {
  const hasThumbnail = !!note.screenshot.tier2Key;
  const thumbnailUrl = useThumbnailUrl(note.uuid, hasThumbnail);
  const [isDeleting, setIsDeleting] = useState(false);

  const timestampLink = note.videoUrl.includes('?')
    ? `${note.videoUrl}&t=${Math.floor(note.timestampSeconds)}`
    : `${note.videoUrl}?t=${Math.floor(note.timestampSeconds)}`;

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await softDeleteNote(note.uuid);
    } catch (err) {
      console.error('NoteCard: delete failed', err);
      setIsDeleting(false);
    }
  };

  return (
    <article
      className={cn(
        'group mx-3 my-1.5 rounded-lg border bg-card text-card-foreground shadow-sm',
        'transition-opacity',
        isDeleting && 'opacity-40 pointer-events-none'
      )}
    >
      {/* Thumbnail */}
      {hasThumbnail && (
        <div className="relative w-full overflow-hidden rounded-t-lg bg-muted">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt="Screenshot"
              className="w-full object-cover max-h-36"
              loading="lazy"
            />
          ) : (
            /* Placeholder prevents layout shift while blob loads */
            <div className="w-full h-28 animate-pulse bg-muted-foreground/10" />
          )}
          {/* Timestamp badge on thumbnail */}
          <a
            href={timestampLink}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono bg-black/65 text-white hover:bg-black/80 transition-colors"
            title="Jump to timestamp"
          >
            <Clock className="h-2.5 w-2.5" />
            {note.timestampString}
          </a>
        </div>
      )}

      <div className="px-3 pt-2 pb-2 flex flex-col gap-1">
        {/* Timestamp link (when no thumbnail) */}
        {!hasThumbnail && (
          <a
            href={timestampLink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors w-fit"
            title="Jump to timestamp"
          >
            <Clock className="h-2.5 w-2.5" />
            {note.timestampString}
          </a>
        )}

        {/* Title */}
        {note.title && (
          <p className="text-xs font-semibold leading-snug text-foreground line-clamp-2">
            {note.title}
          </p>
        )}

        {/* Body */}
        {note.body && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 whitespace-pre-wrap">
            {note.body}
          </p>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-end gap-1 px-2 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={timestampLink}
          target="_blank"
          rel="noreferrer"
          title="Open video at timestamp"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button
          onClick={handleDelete}
          title="Delete note"
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

/** Height estimate used by the virtualizer */
export function estimateNoteHeight(note: NoteProject): number {
  return note.screenshot.tier2Key ? 280 : 120;
}
