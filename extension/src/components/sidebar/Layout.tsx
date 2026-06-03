import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/src/lib/utils';
import { useSidebarStore } from '@/src/store/sidebar';
import { DragHandle } from './DragHandle';
import { Header } from './Header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/src/components/ui/tabs';
import { NoteEditor } from '@/src/components/editor/NoteEditor';
import { CaptureButton } from '@/src/components/editor/CaptureButton';
import { useAutoSnap } from '@/src/hooks/useAutoSnap';

// ---------------------------------------------------------------------------
// Placeholder panels – replaced by real panels in later phases
// ---------------------------------------------------------------------------
function SessionPanel() {
  const { pendingCapture, setPendingCapture } = useSidebarStore();

  const handleSave = (value: { title: string; body: string; screenshotBlob: Blob | null }) => {
    // Phase 5.3 will wire this to Dexie
    console.log('Save note:', value);
    setPendingCapture(null);
  };

  return (
    <NoteEditor
      pendingScreenshot={pendingCapture?.result.thumbnailBlob ?? null}
      timestampLabel={pendingCapture?.timestampLabel}
      onSave={handleSave}
    />
  );
}

function ManagerPanelPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground select-none">
      Manager panel – coming soon
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
interface LayoutProps {
  onDragDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function Layout({ onDragDown, onDragMove, onDragUp }: LayoutProps) {
  const { activeTab, setActiveTab, isCompact } = useSidebarStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMini, setIsMini] = useState(false);

  // Start auto-snap listener
  useAutoSnap();

  // ---- Fullscreen listener ----
  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        setIsMini(true);
      } else {
        setIsMini(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const collapsed = isCollapsed || isMini;
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Drag handle at the very top */}
      <DragHandle
        onPointerDown={onDragDown}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
      />

      {/* Header */}
      <Header
        isCollapsed={collapsed}
        onCollapseToggle={() => setIsCollapsed((v) => !v)}
      />

      {/* Content area – hidden when collapsed; hover-to-expand when in mini-mode */}
      <div
        ref={contentRef}
        className={cn(
          'flex-1 flex flex-col overflow-hidden transition-all duration-200',
          collapsed && 'hidden'
        )}
        // Hover-to-expand when in mini-mode (fullscreen)
        onMouseEnter={() => { if (isMini) setIsMini(false); }}
      >
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'session' | 'manager')}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <TabsList className={cn(
            'shrink-0 w-full rounded-none border-b h-8 bg-muted/40',
            isCompact && 'text-[10px]'
          )}>
            <TabsTrigger value="session" className="flex-1 text-xs">Session</TabsTrigger>
            <TabsTrigger value="manager" className="flex-1 text-xs">Manager</TabsTrigger>
          </TabsList>

          <TabsContent value="session" className="flex-1 overflow-auto m-0 p-0">
            <SessionPanel />
          </TabsContent>
          <TabsContent value="manager" className="flex-1 overflow-auto m-0 p-0">
            <ManagerPanelPlaceholder />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
