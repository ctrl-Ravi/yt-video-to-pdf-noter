import { useCallback } from 'react';
import { getPlatform } from '@/src/platform/detector';
import { useSidebarStore } from '@/src/store/sidebar';
import { getDb } from '@/src/db/database';
import { createNote } from '@/src/db/operations/notes';
import { enqueueOperation } from '@/src/db/operations/sync';
import type { NoteProject, ScreenshotData } from '@yt-noter-pro/shared-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates a UUID v4. Uses crypto.randomUUID where available, falls back to Math.random. */
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Minimal fallback (non-cryptographic)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Formats seconds into a "H:MM:SS" or "M:SS" display string. */
function formatTimestampString(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SaveNoteInput {
  title: string;
  body: string;
  screenshotBlob: Blob | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useSaveNote
 *
 * Returns a `saveNote(input)` function that:
 * 1. Reads the current platform state (timestamp, URL, title)
 * 2. Reads pendingCapture from the Zustand store
 * 3. Writes Tier 2 (thumbnail) + Tier 3 (full screenshot) if a capture exists
 * 4. Writes Tier 1 (NoteProject) + search index in one Dexie transaction
 * 5. Enqueues a sync operation for each connected provider
 * 6. Clears pendingCapture from the Zustand store
 *
 * Position/size stored separately (Phase 4). Editor title/body are cleared
 * by the NoteEditor component itself (it resets on successful save).
 */
export function useSaveNote() {
  const { activeNotebookUuid, pendingCapture, setPendingCapture } = useSidebarStore();

  const saveNote = useCallback(async (input: SaveNoteInput): Promise<string | null> => {
    const platform = getPlatform();
    const db = getDb();
    const now = Date.now();
    const noteUuid = generateUuid();

    // --- Resolve notebook UUID ---
    // Fall back to the first available notebook if none selected
    let notebookUuid = activeNotebookUuid;
    if (!notebookUuid) {
      const first = await db.notebooks.orderBy('displayOrder').first();
      if (!first) {
        // Auto-create a default notebook if none exist
        const defaultUuid = generateUuid();
        await db.notebooks.put({
          uuid: defaultUuid,
          name: 'My Notes',
          displayOrder: 0,
          createdAt: now,
          lastModified: now,
          isDeleted: false,
        });
        notebookUuid = defaultUuid;
      } else {
        notebookUuid = first.uuid;
      }
    }

    // --- Resolve platform data ---
    const timestampSeconds = pendingCapture?.timestampSeconds ?? platform.getCurrentTimestamp();
    const videoUrl = window.location.href;
    const videoTitle = platform.getVideoTitle();
    const platformIdentifier = platform.getPlatformIdentifier();

    // --- Tier 2 & 3: write screenshot blobs if present ---
    let screenshotData: ScreenshotData = {
      tier2Key: null,
      tier3Key: null,
      width: null,
      height: null,
      uncompressed: false,
    };

    const captureResult = pendingCapture?.result ?? null;
    if (captureResult) {
      await db.transaction('rw', [db.thumbnails, db.screenshots], async () => {
        await db.thumbnails.put({ noteUuid, data: captureResult.thumbnailBlob });
        await db.screenshots.put({ noteUuid, data: captureResult.fullBlob });
      });

      screenshotData = {
        tier2Key: noteUuid,      // same key as noteUuid – looked up by PK
        tier3Key: noteUuid,
        width: null,              // width/height not tracked at this tier
        height: null,
        uncompressed: captureResult.uncompressed,
      };
    }

    // --- Tier 1: assemble and write NoteProject ---
    const noteProject: NoteProject = {
      uuid: noteUuid,
      version: 1,
      syncStatus: 'local-only',
      captureMethod: captureResult?.method ?? 'none',
      notebookUuid,
      studySessionUuid: null,
      title: input.title || videoTitle,    // fall back to video title if blank
      body: input.body,
      createdAt: now,
      lastModified: now,
      isDeleted: false,
      platformIdentifier,
      videoUrl,
      videoTitle,
      timestampString: formatTimestampString(timestampSeconds),
      timestampSeconds,
      displayOrder: now,           // use timestamp as default ordering
      screenshot: screenshotData,
      annotations: [],
    };

    await createNote(noteProject);

    // --- Enqueue sync if providers are connected ---
    // Phase 6 will wire real provider detection; for now we check
    // chrome.storage.local for any connectedProviders written by background.
    try {
      const stored = await new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(['connectedProviders'] as string[], (result) => resolve(result as Record<string, unknown>));
      });

      const providers = (stored['connectedProviders'] as string[] | undefined) ?? [];
      if (providers.length > 0) {
        const syncUuid = generateUuid();
        for (const provider of providers) {
          await enqueueOperation({
            uuid: syncUuid,
            noteUuid,
            targetProvider: provider,
            status: 'pending',
            retryCount: 0,
            nextRetryTimestamp: now,
          });
        }
        // Bump note syncStatus to pending-sync
        await db.notes.update(noteUuid, { syncStatus: 'pending-sync' });
      }
    } catch (syncErr) {
      // Non-fatal — note is already saved locally
      console.warn('useSaveNote: failed to enqueue sync', syncErr);
    }

    // --- Clear pending capture from Zustand ---
    setPendingCapture(null);

    return noteUuid;
  }, [activeNotebookUuid, pendingCapture, setPendingCapture]);

  return { saveNote };
}
