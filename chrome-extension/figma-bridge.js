/**
 * Sticker Component Analyzer - Figma Bridge
 * This script runs in the Figma browser context to bridge between
 * the Chrome extension and the Figma plugin
 */

console.log('Sticker Component Analyzer: Figma bridge loaded');

// Check if we're on a Figma page
const isFigmaPage = window.location.hostname.includes('figma.com');

if (isFigmaPage && window.StickerCore) {
  initializeFigmaBridge();
} else {
  console.log('Not a Figma page or core not loaded yet');
}

function initializeFigmaBridge() {
  const { Messenger } = window.StickerCore;
  
  // Listen for messages from the Chrome extension popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.source === 'sticker-chrome-extension') {
      console.log('Figma bridge received extension message:', message);
      
      // Forward the message to the Figma plugin via window.postMessage
      window.postMessage({
        source: 'sticker-chrome-extension',
        componentData: message.componentData || message.data
      }, '*');
      
      // Send success response back
      sendResponse({ success: true });
      return true; // Keep the message channel open for async response
    }
    return false;
  });
  
  // Listen for responses from the Figma plugin
  window.addEventListener('message', (event) => {
    // Handle messages from the Figma plugin
    if (event.data && event.data.source === 'sticker-figma-plugin') {
      console.log('Figma bridge received plugin message:', event.data);
      
      // Forward to Chrome extension if needed
      chrome.runtime.sendMessage({
        action: 'FIGMA_PLUGIN_RESPONSE',
        source: 'sticker-system',
        data: event.data
      });
    }
  });
  
  // Register with the Messenger system
  Messenger.on('COMPONENT_DATA_READY', (data) => {
    console.log('Component data ready to send to Figma plugin:', data);
    window.postMessage({
      source: 'sticker-system',
      type: 'COMPONENT_DATA_READY',
      data: data
    }, '*');
  });
  
  // Notify that the Figma bridge is ready
  window.postMessage({
    source: 'sticker-system',
    type: 'FIGMA_BRIDGE_READY'
  }, '*');
  
  console.log('Sticker Component Analyzer: Figma bridge initialized');
}

// Check for core loading after this script
if (!window.StickerCore) {
  window.addEventListener('StickerCoreLoaded', initializeFigmaBridge);
}
