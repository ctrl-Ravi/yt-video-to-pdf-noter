import React from 'react';
import ReactDOM from 'react-dom/client';
import '../src/content/index.css';
import { detectPlatform } from '@/src/platform/detector';
import { getDb } from '@/src/db/database';

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
        // Phase 3.4: Content script renders null (no visible elements yet)
        root.render(null);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
