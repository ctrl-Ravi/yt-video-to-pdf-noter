import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';

// Tailwind + shadcn: popup has its own document so we inject styles here
import '../../src/content/index.css';

import { Badge } from '../../src/components/ui/badge';

// ---------------------------------------------------------------------------
// Types for status values stored by the background service worker
// ---------------------------------------------------------------------------
type ConnStatus = 'connected' | 'disconnected' | 'unknown';

interface PopupStatus {
  backendStatus: ConnStatus;
  syncProvider: string;          // e.g. 'Google Drive', 'Local only'
  syncStatus: ConnStatus;
  pendingSyncCount: number;
}

const DEFAULT_STATUS: PopupStatus = {
  backendStatus: 'unknown',
  syncProvider: 'Local only',
  syncStatus: 'unknown',
  pendingSyncCount: 0,
};

// ---------------------------------------------------------------------------
// Keyboard shortcuts definition
// ---------------------------------------------------------------------------
const SHORTCUTS = [
  { action: 'Open / Close sidebar', keys: 'Alt + Y' },
  { action: 'Take screenshot', keys: 'Alt + S' },
  { action: 'New note at timestamp', keys: 'Alt + N' },
  { action: 'Toggle auto-snap', keys: 'Alt + A' },
  { action: 'Toggle compact mode', keys: 'Alt + C' },
  { action: 'Export PDF', keys: 'Alt + E' },
];

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------
function StatusDot({ status }: { status: ConnStatus }) {
  const colour =
    status === 'connected'
      ? 'bg-green-500'
      : status === 'disconnected'
      ? 'bg-red-500'
      : 'bg-yellow-400';
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colour} shrink-0`}
    />
  );
}

function StatusBadge({ status }: { status: ConnStatus }) {
  const variant =
    status === 'connected'
      ? 'default'
      : status === 'disconnected'
      ? 'destructive'
      : 'secondary';
  const label =
    status === 'connected'
      ? 'Connected'
      : status === 'disconnected'
      ? 'Offline'
      : 'Unknown';
  return <Badge variant={variant as 'default' | 'destructive' | 'secondary'}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
function App() {
  const [status, setStatus] = useState<PopupStatus>(DEFAULT_STATUS);

  // Read status from extension local storage
  useEffect(() => {
    chrome.storage.local.get(
      ['backendStatus', 'syncProvider', 'syncStatus', 'pendingSyncCount'],
      (result) => {
        setStatus({
          backendStatus: (result.backendStatus as ConnStatus) ?? 'unknown',
          syncProvider: (result.syncProvider as string) ?? 'Local only',
          syncStatus: (result.syncStatus as ConnStatus) ?? 'unknown',
          pendingSyncCount: (result.pendingSyncCount as number) ?? 0,
        });
      }
    );
  }, []);

  return (
    <div className="flex flex-col h-full bg-background text-foreground text-sm font-sans overflow-hidden">
      {/* ---- Header ---- */}
      <header className="flex items-center gap-2 px-4 py-3 border-b bg-muted/40">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary shrink-0">
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-primary-foreground">
            <path d="M2 3h9l3 2.5L14 8H2V3Z" fill="currentColor" fillOpacity=".9" />
            <path d="M2 9h8v4H2V9Z" fill="currentColor" fillOpacity=".5" />
          </svg>
        </div>
        <div>
          <p className="font-semibold leading-none tracking-tight">YT Noter Pro</p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Video note-taking extension</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
        {/* ---- Status Card ---- */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Status
          </h2>
          <div className="rounded-lg border bg-card p-3 flex flex-col gap-2.5">
            {/* Backend */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusDot status={status.backendStatus} />
                <span className="text-xs">Backend API</span>
              </div>
              <StatusBadge status={status.backendStatus} />
            </div>

            {/* Sync provider */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusDot status={status.syncStatus} />
                <span className="text-xs">{status.syncProvider}</span>
              </div>
              <StatusBadge status={status.syncStatus} />
            </div>

            {/* Pending sync count */}
            {status.pendingSyncCount > 0 && (
              <div className="flex items-center justify-between rounded-md bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1.5">
                <span className="text-xs text-yellow-700 dark:text-yellow-400">
                  Pending sync
                </span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {status.pendingSyncCount}
                </Badge>
              </div>
            )}
          </div>
        </section>

        {/* ---- Keyboard Shortcuts Card ---- */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Keyboard Shortcuts
          </h2>
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                {SHORTCUTS.map(({ action, keys }, i) => (
                  <tr
                    key={action}
                    className={i % 2 === 0 ? 'bg-muted/30' : ''}
                  >
                    <td className="px-3 py-1.5 text-foreground/80 w-full">{action}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground shadow-sm">
                        {keys}
                      </kbd>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ---- Footer ---- */}
      <footer className="px-4 py-2 border-t text-[10px] text-muted-foreground flex justify-between">
        <span>v1.0.0</span>
        <span>Open on YouTube to start</span>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
