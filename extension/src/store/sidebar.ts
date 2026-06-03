import { create } from 'zustand';

export type SidebarTab = 'session' | 'manager';

export interface SidebarState {
  isOpen: boolean;
  activeTab: SidebarTab;
  autoSnapEnabled: boolean;
  isCompact: boolean;
  activeNotebookUuid: string | null;

  setIsOpen: (isOpen: boolean) => void;
  setActiveTab: (tab: SidebarTab) => void;
  setAutoSnapEnabled: (enabled: boolean) => void;
  setIsCompact: (isCompact: boolean) => void;
  setActiveNotebookUuid: (uuid: string | null) => void;
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

  setIsOpen: (isOpen) => set({ isOpen }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setAutoSnapEnabled: (autoSnapEnabled) => set({ autoSnapEnabled }),
  setIsCompact: (isCompact) => set({ isCompact }),
  setActiveNotebookUuid: (activeNotebookUuid) => set({ activeNotebookUuid }),
}));
