import React from 'react';
import { cn } from '@/src/lib/utils';
import { useSidebarStore } from '@/src/store/sidebar';

export function AutoSnapPill() {
  const { autoSnapEnabled, setAutoSnapEnabled } = useSidebarStore();

  return (
    <button
      onClick={() => setAutoSnapEnabled(!autoSnapEnabled)}
      title={autoSnapEnabled ? 'Auto-snap on – click to disable' : 'Auto-snap off – click to enable'}
      className={cn(
        'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors border',
        autoSnapEnabled
          ? 'bg-green-500/15 border-green-500/30 text-green-600 dark:text-green-400'
          : 'bg-muted border-border text-muted-foreground'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full transition-colors',
          autoSnapEnabled ? 'bg-green-500' : 'bg-muted-foreground/50'
        )}
      />
      Snap
    </button>
  );
}
