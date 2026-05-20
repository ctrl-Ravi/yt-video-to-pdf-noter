// ── YT Noter v2 PRO — Background Service Worker ──

chrome.runtime.onInstalled.addListener(() => {
  console.log("YT Noter Pro: Service Worker Activated");
});

// Listener for keyboard commands or future background tasks
chrome.commands.onCommand.addListener((command) => {
  console.log(`Command received: ${command}`);
});

// Simple heartbeat to keep the extension alive in Chrome's view
setInterval(() => {
  console.log("YT Noter Pro: Heartbeat");
}, 300000); // Every 5 minutes
