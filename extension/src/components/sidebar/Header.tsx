import React from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { AutoSnapPill } from './AutoSnapPill';
import { NotebookSelector } from './NotebookSelector';
import { useSidebarStore } from '@/src/store/sidebar';

interface HeaderProps {
  isCollapsed: boolean;
  onCollapseToggle: () => void;
}

export function Header({ isCollapsed, onCollapseToggle }: HeaderProps) {
  const { setIsOpen } = useSidebarStore();

  return (
    <div className="shrink-0 border-b bg-background/95 backdrop-blur-sm px-3 pt-2 pb-2 flex flex-col gap-1.5">
      {/* Row 1: Logo + name + controls */}
      <div className="flex items-center gap-2">
        {/* Logo mark */}
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="h-3.5 w-3.5 text-primary-foreground"
          >
            <path
              d="M2 3h9l3 2.5L14 8H2V3Z"
              fill="currentColor"
              fillOpacity=".9"
            />
            <path d="M2 9h8v4H2V9Z" fill="currentColor" fillOpacity=".5" />
          </svg>
        </div>

        <span className="flex-1 text-[11px] font-semibold tracking-wide text-foreground truncate">
          YT Noter Pro
        </span>

        <AutoSnapPill />

        {/* Collapse toggle */}
        <button
          onClick={onCollapseToggle}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {isCollapsed ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Hide / close button */}
        <button
          onClick={() => setIsOpen(false)}
          title="Close sidebar"
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Row 2: Notebook selector – hidden when collapsed */}
      {!isCollapsed && (
        <NotebookSelector />
      )}
    </div>
  );
}
