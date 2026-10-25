// Content script - runs on all pages
// Provides getSelection() for background script injection

// This is intentionally minimal - background uses scripting.executeScript
// But we keep it for future features (e.g., inline definitions)

// Listen for messages from popup if needed
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SELECTION') {
    sendResponse({ text: window.getSelection().toString().trim() });
  }
  return true;
});