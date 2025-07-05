// Content script for the Sticker Component Analyzer Chrome extension
// This script runs in the context of web pages to analyze components and communicate with Figma

console.log('Sticker Component Analyzer: Content script loaded');

// Track script injection state to prevent duplicate injections
let scriptsInjected = false;

// Inject DOM Crawler script into the page
const injectDOMCrawlerScript = () => {
  // Guard against duplicate injections
  if (scriptsInjected) {
    console.log('Scripts already injected, skipping');
    chrome.runtime.sendMessage({ status: "scripts_ready" });
    return;
  }
  
  console.log('Injecting DOM Crawler script');
  try {
    // Check if script is already present
    if (document.querySelector('script[src*="dom-crawler.js"]')) {
      console.log('DOM Crawler script already exists, skipping injection');
      injectElementInspector();
      return;
    }
    
    const script = document.createElement('script');
    script.id = 'sticker-dom-crawler-script';
    script.src = chrome.runtime.getURL('dom-crawler.js');
    script.onload = function() {
      console.log('DOM Crawler script loaded successfully');
      this.remove();
      injectElementInspector();
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (crawlerError) {
    console.error('Error injecting DOM crawler:', crawlerError);
    chrome.runtime.sendMessage({ status: "error", error: crawlerError.message });
  }
};

// Separate function to inject element inspector
const injectElementInspector = () => {
  try {
    // Check if script is already present
    if (document.querySelector('script[src*="element-inspector.js"]')) {
      console.log('Element Inspector script already exists, skipping injection');
      // Still initialize the inspector in case it hasn't been
      document.dispatchEvent(new CustomEvent('STICKER_INIT_INSPECTOR'));
      chrome.runtime.sendMessage({ status: "scripts_ready" });
      scriptsInjected = true;
      return;
    }
    
    const inspectorScript = document.createElement('script');
    inspectorScript.id = 'sticker-inspector-script';
    inspectorScript.src = chrome.runtime.getURL('element-inspector.js');
    inspectorScript.onload = function() {
      console.log('Element Inspector script loaded successfully');
      this.remove();
      // Initialize the element inspector
      document.dispatchEvent(new CustomEvent('STICKER_INIT_INSPECTOR'));
      // Notify extension that scripts are ready
      chrome.runtime.sendMessage({ status: "scripts_ready" });
      scriptsInjected = true;
    };
    (document.head || document.documentElement).appendChild(inspectorScript);
  } catch (inspectorError) {
    console.error('Error injecting element inspector:', inspectorError);
    chrome.runtime.sendMessage({ status: "error", error: inspectorError.message });
  }
};

/**
 * Combined function to inject all required scripts if needed
 */
function injectScriptsIfNeeded() {
  return new Promise((resolve, reject) => {
    try {
      // Check for DOM crawler script
      const crawlerScript = document.querySelector('script[src="chrome-extension://' + chrome.runtime.id + '/dom-crawler.js"]');
      if (!crawlerScript) {
        injectDOMCrawlerScript();
      }
      
      // Check for element inspector script
      const inspectorScript = document.querySelector('script[src="chrome-extension://' + chrome.runtime.id + '/element-inspector.js"]');
      if (!inspectorScript) {
        injectElementInspector();
      }
      
      // Wait a moment to ensure scripts are loaded
      setTimeout(() => {
        debugLog('content-script', 'All scripts injected successfully');
        resolve(true);
      }, 300);
    } catch (error) {
      debugLog('content-script', 'Error injecting scripts:', error);
      reject(error);
    }
  });
}

// Execute the injection when the page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectDOMCrawlerScript();
    // Send a ready signal to the popup
    setTimeout(() => {
      chrome.runtime.sendMessage({ status: "ready" });
    }, 500); // Give scripts time to load
  });
} else {
  injectDOMCrawlerScript();
  // Send a ready signal to the popup
  setTimeout(() => {
    chrome.runtime.sendMessage({ status: "ready" });
  }, 500); // Give scripts time to load
}

// Set up messaging between the page context and the extension
document.addEventListener('STICKER_SEND_TO_EXTENSION', (event) => {
  if (event.detail && event.detail.action) {
    chrome.runtime.sendMessage(event.detail);
  }
});

// Variables for streamlined capture workflow
let hoverElement = null;
let targetElement = null;
let isCapturing = false;

/**
 * Create hover highlight element for streamlined capture
 */
function createHoverHighlight() {
  // Remove existing highlight if present
  const existingHighlight = document.getElementById('sticker-hover-highlight');
  if (existingHighlight) {
    document.body.removeChild(existingHighlight);
  }
  
  // Create new highlight element
  hoverElement = document.createElement('div');
  hoverElement.id = 'sticker-hover-highlight';
  hoverElement.style.cssText = `
    position: absolute;
    pointer-events: none;
    z-index: 999999;
    border: 2px solid #4e68f9;
    background-color: rgba(78, 104, 249, 0.1);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5);
    transition: all 0.15s ease;
    display: none;
  `;
  document.body.appendChild(hoverElement);
  
  // Add success message element
  const successMessage = document.createElement('div');
  successMessage.id = 'sticker-capture-success';
  successMessage.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9999999;
    display: none;
    align-items: center;
    gap: 8px;
  `;
  successMessage.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M6.75 12.15L3.6 9L2.55 10.05L6.75 14.25L15.75 5.25L14.7 4.2L6.75 12.15Z" fill="white"/>
    </svg>
    Component captured! Switch to Figma to paste.
  `;
  document.body.appendChild(successMessage);
  
  // Set capturing state to true
  isCapturing = true;
}

/**
 * Handle mouse movement to highlight elements
 */
function handleMouseMove(event) {
  if (!isCapturing) return;
  
  // Ignore our UI elements
  if (event.target.id === 'sticker-hover-highlight' || 
      event.target.id === 'sticker-capture-success') {
    return;
  }
  
  // Find element under cursor
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (!element) return;
  
  // Update target element
  targetElement = element;
  
  // Update highlight position
  updateHighlight(element);
}

/**
 * Update the highlight position and size to match target element
 */
function updateHighlight(element) {
  if (!hoverElement || !element) return;
  
  const rect = element.getBoundingClientRect();
  
  hoverElement.style.display = 'block';
  hoverElement.style.top = `${rect.top + window.scrollY}px`;
  hoverElement.style.left = `${rect.left + window.scrollX}px`;
  hoverElement.style.width = `${rect.width}px`;
  hoverElement.style.height = `${rect.height}px`;
}

/**
 * Handle click on a component to capture it
 */
function handleComponentClick(event) {
  if (!isCapturing || !targetElement) return;
  
  // Prevent default click action
  event.preventDefault();
  event.stopPropagation();
  
  // Capture the component
  debugLog('content-script', 'Component clicked, capturing:', targetElement);
  
  // Show capturing animation
  const successMessage = document.getElementById('sticker-capture-success');
  if (successMessage) {
    successMessage.style.display = 'flex';
    setTimeout(() => {
      successMessage.style.display = 'none';
    }, 3000);
  }
  
  // Trigger capture in DOM crawler
  document.dispatchEvent(new CustomEvent('STICKER_CAPTURE_COMPONENT', {
    detail: { targetElement }
  }));
  
  // Auto-process component for Figma
  autoProcessComponent();
  
  // Stop capturing
  stopCapture();
}

/**
 * Handle keydown events (escape key to cancel capture)
 */
function handleKeyDown(event) {
  if (event.key === 'Escape' && isCapturing) {
    stopCapture();
  }
}

/**
 * Stop the component capture mode
 */
function stopCapture() {
  isCapturing = false;
  
  // Remove event listeners
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('click', handleComponentClick);
  document.removeEventListener('keydown', handleKeyDown);
  
  // Hide highlight
  if (hoverElement) {
    hoverElement.style.display = 'none';
  }
  
  debugLog('content-script', 'Component capture mode stopped');
}

/**
 * Auto process the captured component and send to Figma
 */
function autoProcessComponent() {
  // After a short delay to ensure component is captured
  setTimeout(() => {
    // Check if we're already in Figma
    const isFigmaTab = window.location.href.includes('figma.com');
    
    if (isFigmaTab) {
      // We're in Figma, send data directly
      debugLog('content-script', 'In Figma tab, sending component directly');
    } else {
      // Find Figma tabs to send to
      chrome.runtime.sendMessage({
        action: 'AUTO_PROCESS_COMPONENT',
        source: 'sticker-content-script'
      });
    }
  }, 500);
}

// Track inspection state in content script context
let isInspectorActive = false;

// Track if Figma plugin is detected and ready
let figmaPluginDetected = false;

// Listen for messages from the Figma plugin to detect its presence
window.addEventListener('message', function(event) {
  // Check if the message is from our Figma plugin
  if (event.data && event.data.source === 'sticker-figma-plugin') {
    figmaPluginDetected = true;
    debugLog('content-script', 'Figma plugin detected and ready:', event.data);
  }
});

// Send a plugin detection message when loaded in a Figma tab
if (window.location.href.includes('figma.com')) {
  // Periodically check for plugin presence
  setInterval(() => {
    window.postMessage({
      source: 'sticker-chrome-extension',
      action: 'DETECT_PLUGIN'
    }, '*');
  }, 2000); // Check every 2 seconds
}

/**
 * Debug logging utility with timestamps and source indicators
 */
function debugLog(source, ...args) {
  const timestamp = new Date().toISOString().substring(11, 23);
  console.log(`[${timestamp}][${source}]`, ...args);
}

// Listen for messages from the extension popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog('content-script', 'Received message:', message);
  
  // Handle Figma plugin readiness check
  if (message.action === 'CHECK_FIGMA_PLUGIN_READY' && message.source === 'sticker-chrome-extension') {
    sendResponse({ready: figmaPluginDetected, time: new Date().getTime()});
    return true;
  }

  // Handle streamlined component capture workflow
  if (message.action === "START_COMPONENT_CAPTURE") {
    try {
      // Inject scripts if not already done
      injectScriptsIfNeeded().then(() => {
        // Start streamlined capture mode
        document.dispatchEvent(new CustomEvent('STICKER_START_STREAMLINED_CAPTURE'));
        
        // Create and add the hover highlight element if it doesn't exist
        createHoverHighlight();
        
        // Add mousemove listener for hover highlight
        document.addEventListener('mousemove', handleMouseMove);
        
        // Add click listener for capture
        document.addEventListener('click', handleComponentClick);
        
        // Add escape key listener to cancel
        document.addEventListener('keydown', handleKeyDown);
        
        sendResponse({success: true});
      }).catch(error => {
        debugLog('content-script', 'Error injecting scripts:', error);
        sendResponse({success: false, error: error.message});
      });
    } catch (error) {
      debugLog('content-script', 'Error starting component capture:', error);
      sendResponse({success: false, error: error.message});
    }
    return true;
  }

  // Legacy handlers (keeping for backward compatibility)
  if (message.action === "TOGGLE_INSPECTION") {
    try {
      injectScriptsIfNeeded().then(() => {
        document.dispatchEvent(new CustomEvent('STICKER_TOGGLE_INSPECTION'));
        sendResponse({success: true});
      }).catch(error => {
        debugLog('content-script', 'Error injecting scripts:', error);
        sendResponse({success: false, error: error.message});
      });
    } catch (error) {
      debugLog('content-script', 'Error toggling inspection:', error);
      sendResponse({success: false, error: error.message});
    }
    return true;
  }

  // Handle component capture
  if (message.action === "CAPTURE_COMPONENT") {
    try {
      document.dispatchEvent(new CustomEvent('STICKER_CAPTURE_COMPONENT'));
      sendResponse({success: true});
    } catch (error) {
      debugLog('content-script', 'Error capturing component:', error);
      sendResponse({success: false, error: error.message});
    }
    return true;
  }

  // Handle SEND_TO_FIGMA_PLUGIN message (forward data to Figma)
  if (message.action === 'SEND_TO_FIGMA_PLUGIN' && message.source === 'sticker-chrome-extension') {
    console.log('Content script received data for Figma plugin:', message);
    
    try {
      // Check if this is a Figma tab
      const isFigmaTab = window.location.href.includes('figma.com');
      
      if (isFigmaTab) {
        // Forward the message to the Figma plugin via window.postMessage with ALL message properties
        // Make sure we're forwarding the complete message structure including action and type
        console.log('Forwarding to Figma plugin:', message);
        window.postMessage(message, '*');
        
        // Send success response back to the extension popup
        setTimeout(() => {
          sendResponse({ success: true });
        }, 100);
      } else {
        sendResponse({ success: false, error: 'Not a Figma tab' });
      }
      return true; // Indicates we'll send a response asynchronously
    } catch (error) {
      console.error('Failed to send data to Figma plugin:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }
  
  // Handle GET_INSPECTION_STATUS message
  if (message.action === 'GET_INSPECTION_STATUS') {
    console.log('Content script reporting inspection status:', isInspectorActive);
    sendResponse({ isInspecting: isInspectorActive });
    return true;
  }
  
  // Handle START_INSPECTION message
  if (message.action === 'START_INSPECTION') {
    console.log('Content script starting element inspection');
    isInspectorActive = true;
    
    try {
      // Tell the page to start inspection
      document.dispatchEvent(new CustomEvent('STICKER_START_INSPECTION'));
      
      // Make sure scripts are injected if they weren't already
      if (!window.scriptsInjected) {
        injectDOMCrawlerScript();
        window.scriptsInjected = true;
      }
      
      setTimeout(() => {
        sendResponse({ success: true, isInspecting: true });
      }, 100);
    } catch (error) {
      console.error('Error starting inspection:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  // Handle STOP_INSPECTION message
  if (message.action === 'STOP_INSPECTION') {
    console.log('Content script stopping element inspection');
    isInspectorActive = false;
    
    // Tell the page to stop inspection
    document.dispatchEvent(new CustomEvent('STICKER_STOP_INSPECTION'));
    
    setTimeout(() => {
      sendResponse({ success: true, isInspecting: false });
    }, 100);
    return true;
  }
  
  // Handle CAPTURE_COMPONENT message
  if (message.action === 'CAPTURE_COMPONENT') {
    console.log('Content script triggering component capture');
    
    // Tell the page to capture the currently selected component
    document.dispatchEvent(new CustomEvent('STICKER_CAPTURE_COMPONENT'));
    
    setTimeout(() => {
      sendResponse({ success: true });
    }, 100);
    return true;
  }
  
  return false; // Not handled by this listener
});

// Listen for messages from page scripts via DOM events
document.addEventListener('STICKER_SEND_TO_EXTENSION', (event) => {
  console.log('Content script received page event:', event.detail);
  
  if (event.detail) {
    // Forward the message to the extension popup
    chrome.runtime.sendMessage(event.detail);
  }
});

document.addEventListener('ELEMENT_VARIANTS_CAPTURED', (event) => {
  if (event.detail) {
    chrome.runtime.sendMessage({
      action: 'ELEMENT_VARIANTS_CAPTURED',
      data: event.detail
    });
  }
});

document.addEventListener('SEND_TO_FIGMA', (event) => {
  if (event.detail) {
    chrome.runtime.sendMessage({
      action: 'SEND_TO_FIGMA',
      data: event.detail
    });
  }
});

// Listen for responses from the Figma plugin (when in Figma tab)
window.addEventListener('message', (event) => {
  // Verify the message is from our Visionary UI Figma plugin
  if (event.data && (event.data.source === 'visionary-ui-figma-plugin' || event.data.source === 'sticker-figma-plugin')) {
    console.log('Received response from Visionary UI plugin:', event.data);
    
    // Handle plugin ready signal
    if (event.data.type === 'plugin-ready') {
      console.log('Visionary UI plugin is ready to receive components');
      
      // Notify extension that plugin is ready
      chrome.runtime.sendMessage({
        action: 'FIGMA_PLUGIN_READY',
        source: event.data.source
      });
    }
    
    // Handle plugin heartbeat
    if (event.data.type === 'plugin-heartbeat') {
      // Update plugin status for extension
      chrome.runtime.sendMessage({
        action: 'FIGMA_PLUGIN_HEARTBEAT',
        timestamp: event.data.timestamp
      });
    }
    
    // Forward other responses back to extension if needed
    if (event.data.response) {
      chrome.runtime.sendMessage({
        action: 'FIGMA_PLUGIN_RESPONSE',
        data: event.data.response
      });
    }
  }
}, false);

// Note: We're no longer using inline scripts to avoid CSP violations
// All the event listeners are now in element-inspector.js directly
