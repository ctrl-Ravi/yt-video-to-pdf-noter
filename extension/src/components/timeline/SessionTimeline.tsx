import React, { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '@/src/db/database';
import { useSidebarStore } from '@/src/store/sidebar';
import { NoteCard, estimateNoteHeight } from './NoteCard';
import { NoteProject } from '@yt-noter-pro/shared-types';

const BOTTOM_THRESHOLD = 200; // px – auto-scroll tolerance

interface SessionTimelineProps {
  /** Filter notes to this video URL; when undefined shows all notes in the notebook */
  videoUrl?: string;
}

export function SessionTimeline({ videoUrl }: SessionTimelineProps) {
  const { activeNotebookUuid } = useSidebarStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Live query – re-runs whenever notes table changes
  const notes = (useLiveQuery<NoteProject[]>(
    async () => {
      const db = getDb();

      if (videoUrl) {
        return db.notes
          .where({ videoUrl })
          .filter((n) => !n.isDeleted && (!activeNotebookUuid || n.notebookUuid === activeNotebookUuid))
          .sortBy('timestampSeconds');
      }

      if (activeNotebookUuid) {
        return db.notes
          .where({ notebookUuid: activeNotebookUuid })
          .filter((n) => !n.isDeleted)
          .sortBy('timestampSeconds');
      }

      return db.notes.filter((n) => !n.isDeleted).sortBy('timestampSeconds');
    },
    [videoUrl, activeNotebookUuid]
  ) ?? []) as NoteProject[];

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: notes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => estimateNoteHeight(notes[index]),
    overscan: 3,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Auto-scroll to newest note when count increases, only if near bottom
  useEffect(() => {
    const prevCount = prevCountRef.current;
    const newCount = notes.length;
    prevCountRef.current = newCount;

    if (newCount <= prevCount || newCount === 0) return;

    const el = scrollRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom <= BOTTOM_THRESHOLD) {
      virtualizer.scrollToIndex(newCount - 1, { align: 'end', behavior: 'smooth' });
    }
  }, [notes.length, virtualizer]);

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
        <p className="text-sm font-medium text-foreground">No notes yet</p>
        <p className="text-xs text-muted-foreground">
          {videoUrl
            ? 'Use the editor above to capture your first note for this video.'
            : 'Select a notebook and start taking notes.'}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto overflow-x-hidden relative"
    >
      {/* TanStack Virtual outer container */}
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
      >
        {virtualItems.map((virtualRow) => {
          const note = notes[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <NoteCard
                note={note}
                estimatedHeight={estimateNoteHeight(note)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
