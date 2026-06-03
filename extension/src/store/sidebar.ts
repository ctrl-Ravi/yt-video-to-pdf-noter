import { create } from 'zustand';
import type { FinalCaptureResult } from '@/src/capture';

export type SidebarTab = 'session' | 'manager';

export interface PendingCapture {
  result: FinalCaptureResult;
  /** Seconds at which the frame was captured */
  timestampSeconds: number;
  /** Human-readable label, e.g. "3:42" */
  timestampLabel: string;
}

export interface SidebarState {
  isOpen: boolean;
  activeTab: SidebarTab;
  autoSnapEnabled: boolean;
  isCompact: boolean;
  activeNotebookUuid: string | null;
  /** Screenshot captured but not yet saved to a note */
  pendingCapture: PendingCapture | null;

  setIsOpen: (isOpen: boolean) => void;
  setActiveTab: (tab: SidebarTab) => void;
  setAutoSnapEnabled: (enabled: boolean) => void;
  setIsCompact: (isCompact: boolean) => void;
  setActiveNotebookUuid: (uuid: string | null) => void;
  setPendingCapture: (capture: PendingCapture | null) => void;
}

/**
 * Global store for sidebar UI state.
 * 
 * Note: Position and size are NOT tracked here to avoid render thrash on drag.
 * They should be applied as inline styles and persisted via WXT storage API.
 */
export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: false,
  activeTab: 'session',
  autoSnapEnabled: true,
  isCompact: false,
  activeNotebookUuid: null,
  pendingCapture: null,

  setIsOpen: (isOpen) => set({ isOpen }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setAutoSnapEnabled: (autoSnapEnabled) => set({ autoSnapEnabled }),
  setIsCompact: (isCompact) => set({ isCompact }),
  setActiveNotebookUuid: (activeNotebookUuid) => set({ activeNotebookUuid }),
  setPendingCapture: (pendingCapture) => set({ pendingCapture }),
}));
