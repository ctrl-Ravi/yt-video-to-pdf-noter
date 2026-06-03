import React from 'react';
import ReactDOM from 'react-dom/client';
import '../src/content/index.css';
import { detectPlatform } from '@/src/platform/detector';
import { getDb } from '@/src/db/database';
import { Shell } from '@/src/components/sidebar/Shell';
import { useSidebarStore } from '@/src/store/sidebar';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log('YT Noter Pro content script loaded');
    // Initialize platform and DB once when script runs in browser
    detectPlatform();
    getDb();

    const ui = await createShadowRootUi(ctx, {
      name: 'yt-noter-pro-root',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(
          <React.StrictMode>
            <Shell />
          </React.StrictMode>
        );
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });
    ui.mount();

    // Open the sidebar by default so users see it immediately on first load.
    // In later phases this will respect the user's saved isOpen preference.
    useSidebarStore.getState().setIsOpen(true);
  },
});
