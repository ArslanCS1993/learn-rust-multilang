// Background service worker for MV3
let popupPort = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    popupPort = port;
    port.onDisconnect.addListener(() => { popupPort = null; });
  }
});

function sendToPopup(message) {
  if (popupPort) {
    popupPort.postMessage(message);
  } else {
    // Store for when popup opens
    chrome.storage.session.set({ pendingLookup: message });
  }
}

async function getSelectedText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString().trim()
    });
    return results[0]?.result || null;
  } catch {
    return null;
  }
}

async function handleLookup() {
  const text = await getSelectedText();
  if (text) {
    sendToPopup({ type: 'LOOKUP', text });
    // Also open popup
    chrome.action.openPopup();
  }
}

// Keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === 'lookup-selection') {
    handleLookup();
  } else if (command === 'open-popup') {
    chrome.action.openPopup();
  }
});

// Context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'lookup-chinese',
    title: 'Lookup "%s" in Algorithm Chinese Vocab',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'lookup-chinese' && info.selectionText) {
    sendToPopup({ type: 'LOOKUP', text: info.selectionText.trim() });
    chrome.action.openPopup();
  }
});

// Handle popup opened - check for pending lookup
chrome.action.onClicked.addListener(async () => {
  const { pendingLookup } = await chrome.storage.session.get('pendingLookup');
  if (pendingLookup) {
    await chrome.storage.session.remove('pendingLookup');
    // Give popup time to connect
    setTimeout(() => sendToPopup(pendingLookup), 100);
  }
});