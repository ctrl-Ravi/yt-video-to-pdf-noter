export function setupTabCaptureHandler() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TAB_CAPTURE_REQUEST') {
      chrome.tabs.captureVisibleTab(
        sender.tab?.windowId || chrome.windows.WINDOW_ID_CURRENT,
        { format: 'png' },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ dataUrl });
          }
        }
      );
      return true; // Keep message channel open for async response
    }
  });
}
