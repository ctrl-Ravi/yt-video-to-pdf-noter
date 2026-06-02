import { setupTabCaptureHandler } from '@/src/capture';

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener((details) => {
    console.log('YT Noter Pro installed:', details.reason);
  });

  chrome.runtime.onStartup.addListener(() => {
    console.log('YT Noter Pro background service worker started');
  });

  setupTabCaptureHandler();
});
