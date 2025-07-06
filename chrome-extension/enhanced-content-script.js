/**
 * Enhanced Content Script for Sticker Component Analyzer
 * Uses the new TypeScript modules for improved capture and selection
 */

// Dynamic import with fallback
async function loadEnhancedModules() {
  try {
    // Try to load the compiled modules
    const indexModule = await import(chrome.runtime.getURL('dist/index.js'));
    
    if (indexModule.elementSelector && indexModule.elementCapture) {
      console.log('Enhanced extension modules loaded successfully');
      
      // Make available globally for other scripts
      window.stickerElementSelector = indexModule.elementSelector;
      window.stickerElementCapture = indexModule.elementCapture;
      
      // Initialize enhanced functionality
      initializeEnhancedFeatures();
      return true;
    }
  } catch (error) {
    console.warn('Failed to load enhanced extension modules:', error);
  }
  
  // Fallback to existing functionality
  console.log('Using fallback functionality');
  initializeFallbackFeatures();
  return false;
}

/**
 * Initialize enhanced features
 */
function initializeEnhancedFeatures() {
  console.log('Initializing enhanced capture and selection features');
  
  // Enhanced message handling
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Enhanced content script received message:', message.action);
    
    switch (message.action) {
      case 'START_ENHANCED_SELECTION':
        startEnhancedSelection(message.options || {});
        sendResponse({ success: true });
        return true;
        
      case 'STOP_ENHANCED_SELECTION':
        stopEnhancedSelection();
        sendResponse({ success: true });
        return true;
        
      case 'CAPTURE_ENHANCED_ELEMENTS':
        captureEnhancedElements(message.options || {});
        sendResponse({ success: true });
        return true;
        
      case 'GET_SELECTED_ELEMENTS':
        const selectedElements = window.stickerElementSelector?.getSelectedElements() || [];
        sendResponse({ success: true, elements: selectedElements });
        return true;
        
      default:
        return handleLegacyMessage(message, sender, sendResponse);
    }
  });
  
  // Enhanced DOM events
  document.addEventListener('STICKER_START_ENHANCED_SELECTION', (event) => {
    const options = event.detail || {};
    startEnhancedSelection(options);
  });
  
  document.addEventListener('STICKER_STOP_ENHANCED_SELECTION', () => {
    stopEnhancedSelection();
  });
  
  document.addEventListener('STICKER_CAPTURE_ENHANCED', async (event) => {
    const options = event.detail || {};
    await captureEnhancedElements(options);
  });
}

/**
 * Start enhanced element selection
 */
function startEnhancedSelection(options = {}) {
  if (!window.stickerElementSelector) {
    console.error('Enhanced element selector not available');
    return;
  }
  
  const selectionOptions = {
    multiSelect: options.multiSelect || false,
    showPreview: options.showPreview !== false, // Default true
    confirmCapture: options.confirmCapture !== false, // Default true
    highlightColor: options.highlightColor || '#007ACC',
    borderWidth: options.borderWidth || 2,
    ...options
  };
  
  window.stickerElementSelector.startSelection(selectionOptions);
  
  // Notify extension
  chrome.runtime.sendMessage({
    action: 'ENHANCED_SELECTION_STARTED',
    options: selectionOptions
  });
}

/**
 * Stop enhanced element selection
 */
function stopEnhancedSelection() {
  if (!window.stickerElementSelector) {
    console.error('Enhanced element selector not available');
    return;
  }
  
  window.stickerElementSelector.stopSelection();
  
  // Notify extension
  chrome.runtime.sendMessage({
    action: 'ENHANCED_SELECTION_STOPPED'
  });
}

/**
 * Capture enhanced elements
 */
async function captureEnhancedElements(options = {}) {
  if (!window.stickerElementSelector || !window.stickerElementCapture) {
    console.error('Enhanced capture modules not available');
    return;
  }
  
  try {
    const captureOptions = {
      highDPI: options.highDPI !== false, // Default true
      includeCrossOrigin: options.includeCrossOrigin !== false, // Default true
      scrollLargeElements: options.scrollLargeElements !== false, // Default true
      includeShadowDOM: options.includeShadowDOM !== false, // Default true
      quality: options.quality || 0.95,
      ...options
    };
    
    const results = await window.stickerElementSelector.captureSelectedElements(captureOptions);
    
    // Send results to extension
    results.forEach((result, index) => {
      chrome.runtime.sendMessage({
        action: 'ENHANCED_ELEMENT_CAPTURED',
        data: {
          index,
          total: results.length,
          imageData: result.dataUrl,
          width: result.width,
          height: result.height,
          pixelRatio: result.pixelRatio,
          metadata: result.metadata
        }
      });
    });
    
    // Send completion message
    chrome.runtime.sendMessage({
      action: 'ENHANCED_CAPTURE_COMPLETE',
      data: {
        totalElements: results.length,
        totalSize: results.reduce((sum, r) => sum + r.dataUrl.length, 0)
      }
    });
    
    console.log(`Enhanced capture completed: ${results.length} elements captured`);
    
  } catch (error) {
    console.error('Enhanced capture failed:', error);
    chrome.runtime.sendMessage({
      action: 'ENHANCED_CAPTURE_ERROR',
      error: error.message
    });
  }
}

/**
 * Handle legacy messages for backward compatibility
 */
function handleLegacyMessage(message, sender, sendResponse) {
  switch (message.action) {
    case 'TOGGLE_INSPECTION':
      // Map to enhanced selection
      if (message.enable) {
        startEnhancedSelection({ multiSelect: false });
      } else {
        stopEnhancedSelection();
      }
      sendResponse({ success: true });
      return true;
      
    case 'CAPTURE_COMPONENT':
      // Map to enhanced capture
      captureEnhancedElements();
      sendResponse({ success: true });
      return true;
      
    case 'STATUS_CHECK':
      sendResponse({ 
        success: true,
        enhanced: !!window.stickerElementSelector
      });
      return true;
      
    default:
      return false;
  }
}

/**
 * Initialize fallback features if enhanced modules fail to load
 */
function initializeFallbackFeatures() {
  console.log('Initializing fallback features');
  
  // Try to inject existing scripts
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('dom-crawler.js');
    script.onload = () => {
      const inspectorScript = document.createElement('script');
      inspectorScript.src = chrome.runtime.getURL('element-inspector.js');
      inspectorScript.onload = () => {
        console.log('Fallback scripts loaded');
        chrome.runtime.sendMessage({ status: "fallback_ready" });
      };
      document.head.appendChild(inspectorScript);
    };
    document.head.appendChild(script);
  } catch (error) {
    console.error('Failed to load fallback scripts:', error);
  }
  
  // Set up basic message handling
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Fallback content script received message:', message.action);
    return handleLegacyMessage(message, sender, sendResponse);
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadEnhancedModules();
  });
} else {
  loadEnhancedModules();
}

// Send ready signal to popup with feature detection
setTimeout(() => {
  chrome.runtime.sendMessage({ 
    status: "enhanced_ready",
    features: {
      enhancedCapture: !!window.stickerElementCapture,
      enhancedSelection: !!window.stickerElementSelector
    }
  });
}, 1000);

console.log('Enhanced Sticker Component Analyzer content script loaded');