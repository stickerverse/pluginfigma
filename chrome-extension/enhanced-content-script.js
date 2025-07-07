/**
 * Auto-Scan Content Script for Canvas Weaver
 * Automatically scans and highlights images with blue overlay
 */

// Wrap everything in an IIFE to allow early returns
(function() {
  // Check if extension context is valid
  if (!chrome || !chrome.runtime || !chrome.runtime.id) {
    console.log('Canvas Weaver: Extension context invalidated, script will not initialize');
    return;
  }

// Auto-scan state
let isAutoScanning = false;
let scannedImages = [];
let overlayElements = [];

// Initialize auto-scan functionality
try {
  initializeAutoScan();
} catch (error) {
  console.error('Canvas Weaver: Failed to initialize:', error);
}

/**
 * Initialize auto-scan functionality
 */
function initializeAutoScan() {
  console.log('Canvas Weaver auto-scan content script loaded');
  
  // Listen for messages from popup with error handling
  try {
    chrome.runtime.onMessage.addListener(handleAutoScanMessages);
  } catch (error) {
    console.error('Canvas Weaver: Failed to add message listener:', error);
    return;
  }
  
  // Inject auto-scan styles
  injectAutoScanStyles();
  
  // Send ready signal with error handling
  setTimeout(() => {
    try {
      if (chrome && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({ 
          action: "auto_scan_ready",
          url: window.location.href
        }).catch(() => {
          // Ignore errors if extension context is invalidated
        });
      }
    } catch (error) {
      console.log('Canvas Weaver: Cannot send ready signal, extension context may be invalidated');
    }
  }, 1000);
}

/**
 * Handle messages from popup
 */
function handleAutoScanMessages(message, sender, sendResponse) {
  console.log('Auto-scan content script received message:', message.action);
  
  switch (message.action) {
    case 'START_AUTO_SCAN':
      startAutoScan(message.options || {});
      sendResponse({ success: true });
      return true;
      
    case 'STOP_AUTO_SCAN':
      stopAutoScan();
      sendResponse({ success: true });
      return true;
      
    case 'STATUS_CHECK':
      sendResponse({ 
        success: true,
        autoScan: isAutoScanning,
        imageCount: scannedImages.length
      });
      return true;
      
    default:
      return false;
  }
}

/**
 * Start auto-scanning for images
 */
function startAutoScan(options = {}) {
  if (isAutoScanning) return;
  
  console.log('Starting auto-scan for images');
  isAutoScanning = true;
  
  // Scan for all images on the page
  scanForImages();
  
  // Set up mutation observer for dynamic content
  setupMutationObserver();
  
  // Notify popup with error handling
  try {
    if (chrome && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({
        action: 'AUTO_SCAN_STARTED',
        data: {
          imageCount: scannedImages.length,
          url: window.location.href
        }
      }).catch(() => {
        // Ignore errors if extension context is invalidated
      });
    }
  } catch (error) {
    console.log('Canvas Weaver: Cannot notify popup, extension context may be invalidated');
  }
}

/**
 * Stop auto-scanning
 */
function stopAutoScan() {
  if (!isAutoScanning) return;
  
  console.log('Stopping auto-scan');
  isAutoScanning = false;
  
  // Remove all overlays
  removeAllOverlays();
  
  // Clear scanned images
  scannedImages = [];
  
  // Notify popup with error handling
  try {
    if (chrome && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({
        action: 'AUTO_SCAN_STOPPED'
      }).catch(() => {
        // Ignore errors if extension context is invalidated
      });
    }
  } catch (error) {
    console.log('Canvas Weaver: Cannot notify popup, extension context may be invalidated');
  }
}

/**
 * Scan for convertible images on the page
 */
function scanForImages() {
  // Remove existing overlays
  removeAllOverlays();
  scannedImages = [];
  
  // Find all images and image-like elements
  const imageSelectors = [
    'img',
    '[style*="background-image"]',
    'canvas',
    'svg',
    'picture',
    '[role="img"]',
    '.image, .img, .photo',
    '[data-src]',
    '[data-background]'
  ];
  
  imageSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      if (isValidImageElement(element)) {
        addImageToScan(element);
      }
    });
  });
  
  console.log(`Found ${scannedImages.length} convertible images`);
  
  // Update count in popup with error handling
  try {
    if (chrome && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({
        action: 'IMAGE_COUNT_UPDATED',
        count: scannedImages.length
      }).catch(() => {
        // Ignore errors if extension context is invalidated
      });
    }
  } catch (error) {
    console.log('Canvas Weaver: Cannot update popup count, extension context may be invalidated');
  }
}

/**
 * Check if element is a valid image for conversion
 */
function isValidImageElement(element) {
  // Skip if element is too small
  const rect = element.getBoundingClientRect();
  if (rect.width < 50 || rect.height < 50) return false;
  
  // Skip if element is hidden
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  
  // Skip if element is not visible in viewport (with some margin)
  if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return false;
  
  // Check for actual image content
  if (element.tagName === 'IMG') {
    return element.src && element.complete && element.naturalWidth > 0;
  }
  
  if (element.tagName === 'CANVAS') {
    return rect.width > 0 && rect.height > 0;
  }
  
  if (element.tagName === 'SVG') {
    return true;
  }
  
  // Check for background images
  if (style.backgroundImage && style.backgroundImage !== 'none') {
    return true;
  }
  
  return false;
}

/**
 * Add image element to scan list and create overlay
 */
function addImageToScan(element) {
  // Avoid duplicates
  if (scannedImages.includes(element)) return;
  
  scannedImages.push(element);
  createImageOverlay(element);
}

/**
 * Create blue overlay for image element
 */
function createImageOverlay(element) {
  const overlay = document.createElement('div');
  overlay.className = 'canvas-weaver-overlay';
  overlay.dataset.canvasWeaverTarget = 'true';
  
  // Position overlay over the element
  positionOverlay(overlay, element);
  
  // Add hover effects
  let isHovered = false;
  
  const showOverlay = () => {
    if (!isHovered) {
      isHovered = true;
      overlay.style.opacity = '1';
      overlay.style.transform = 'scale(1.02)';
    }
  };
  
  const hideOverlay = () => {
    if (isHovered) {
      isHovered = false;
      overlay.style.opacity = '0';
      overlay.style.transform = 'scale(1)';
    }
  };
  
  // Mouse events for element and overlay
  element.addEventListener('mouseenter', showOverlay);
  element.addEventListener('mouseleave', hideOverlay);
  overlay.addEventListener('mouseenter', showOverlay);
  overlay.addEventListener('mouseleave', hideOverlay);
  
  // Click handler for capture
  const captureHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Immediately show visual feedback
    overlay.style.border = '3px solid #00ff00';
    overlay.style.background = 'rgba(0, 255, 0, 0.2)';
    
    // Add processing indicator
    const processingIndicator = document.createElement('div');
    processingIndicator.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #007ACC;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      z-index: 1000001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    processingIndicator.textContent = '🔄 Processing...';
    overlay.appendChild(processingIndicator);
    
    // Process in background
    setTimeout(() => {
      captureImageElement(element, overlay, processingIndicator);
    }, 100);
  };
  
  element.addEventListener('click', captureHandler, true);
  overlay.addEventListener('click', captureHandler, true);
  
  // Store reference for cleanup
  overlay._canvasWeaverElement = element;
  overlay._canvasWeaverCaptureHandler = captureHandler;
  
  document.body.appendChild(overlay);
  overlayElements.push(overlay);
}

/**
 * Position overlay over target element
 */
function positionOverlay(overlay, element) {
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  
  overlay.style.position = 'absolute';
  overlay.style.top = (rect.top + scrollTop - 2) + 'px';
  overlay.style.left = (rect.left + scrollLeft - 2) + 'px';
  overlay.style.width = (rect.width + 4) + 'px';
  overlay.style.height = (rect.height + 4) + 'px';
  overlay.style.pointerEvents = 'auto';
  overlay.style.zIndex = '999999';
}

/**
 * Capture clicked image element
 */
async function captureImageElement(element, overlay, processingIndicator) {
  console.log('Capturing image element:', element);
  
  try {
    // Update processing indicator
    processingIndicator.innerHTML = '📸 Capturing...';
    
    // Capture the element data
    const captureData = await captureElementData(element);
    
    // Update indicator
    processingIndicator.innerHTML = '🚀 Sending to Figma...';
    
    // Send directly to background script for WebSocket transmission
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) {
        throw new Error('Extension context invalidated');
      }
      
      chrome.runtime.sendMessage({
        action: 'send_component_data',
        data: {
          type: 'image_capture',
          imageData: captureData.dataUrl,
          metadata: captureData.metadata,
          timestamp: Date.now(),
          source: 'auto-scan'
        }
      }).then((response) => {
        if (response && response.success) {
          // Success feedback
          processingIndicator.innerHTML = '✅ Sent to Figma!';
          overlay.style.border = '3px solid #00ff00';
          overlay.style.background = 'rgba(0, 255, 0, 0.3)';
          
          // Show notification with fallback info if applicable
          const message = captureData.metadata.isFallback 
            ? 'Component placeholder sent to Figma! (Original image had CORS restrictions) Press Cmd+V (Mac) or Ctrl+V (Windows) to paste.'
            : 'Component sent to Figma! Press Cmd+V (Mac) or Ctrl+V (Windows) to paste in Figma.';
          showPageNotification(message);
          
          // Clean up after delay
          setTimeout(() => {
            if (overlay.parentNode) {
              overlay.parentNode.removeChild(overlay);
            }
          }, 3000);
          
        } else {
          // Error feedback
          processingIndicator.innerHTML = '❌ Failed to send';
          overlay.style.border = '3px solid #ff0000';
          overlay.style.background = 'rgba(255, 0, 0, 0.2)';
          
          showPageNotification('Failed to send to Figma. Make sure the plugin is connected.');
          
          setTimeout(() => {
            // Reset overlay
            overlay.style.border = '3px solid #007ACC';
            overlay.style.background = 'rgba(0, 122, 204, 0.1)';
            if (processingIndicator.parentNode) {
              processingIndicator.remove();
            }
          }, 3000);
        }
      }).catch((error) => {
        // Handle promise rejection
        processingIndicator.innerHTML = '❌ Connection failed';
        overlay.style.border = '3px solid #ff0000';
        overlay.style.background = 'rgba(255, 0, 0, 0.2)';
        
        showPageNotification('Failed to connect to Canvas Weaver. Try reloading the extension.');
        
        setTimeout(() => {
          // Reset overlay
          overlay.style.border = '3px solid #007ACC';
          overlay.style.background = 'rgba(0, 122, 204, 0.1)';
          if (processingIndicator.parentNode) {
            processingIndicator.remove();
          }
        }, 3000);
      });
    } catch (error) {
      // Handle sync errors
      processingIndicator.innerHTML = '❌ Extension error';
      overlay.style.border = '3px solid #ff0000';
      overlay.style.background = 'rgba(255, 0, 0, 0.2)';
      
      showPageNotification('Canvas Weaver extension needs to be reloaded.');
      
      setTimeout(() => {
        // Reset overlay
        overlay.style.border = '3px solid #007ACC';
        overlay.style.background = 'rgba(0, 122, 204, 0.1)';
        if (processingIndicator.parentNode) {
          processingIndicator.remove();
        }
      }, 3000);
    }
    
  } catch (error) {
    console.error('Failed to capture image element:', error);
    
    // Error feedback
    processingIndicator.innerHTML = '❌ Capture failed';
    overlay.style.border = '3px solid #ff0000';
    overlay.style.background = 'rgba(255, 0, 0, 0.2)';
    
    // Show specific message for CORS errors
    let errorMessage = error.message;
    if (error.message.includes('Tainted canvases') || error.message.includes('CORS')) {
      errorMessage = 'Image has CORS restrictions. Canvas Weaver will create a placeholder component instead.';
    }
    showPageNotification('Failed to capture image: ' + errorMessage);
    
    setTimeout(() => {
      // Reset overlay
      overlay.style.border = '3px solid #007ACC';
      overlay.style.background = 'rgba(0, 122, 204, 0.1)';
      processingIndicator.remove();
    }, 3000);
  }
}

/**
 * Capture element data for processing
 */
async function captureElementData(element) {
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  
  // Create canvas for capture
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size with device pixel ratio for high-DPI
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  
  // Capture different types of elements with CORS handling
  if (element.tagName === 'IMG') {
    try {
      // Check if image is loaded and accessible
      if (element.complete && element.naturalWidth > 0) {
        // Check for potential CORS issues
        const imageUrl = new URL(element.src, window.location.href);
        const currentOrigin = window.location.origin;
        const isSameOrigin = imageUrl.origin === currentOrigin;
        
        if (!isSameOrigin) {
          console.warn('Canvas Weaver: Cross-origin image detected, may cause tainted canvas:', element.src);
        }
        
        ctx.drawImage(element, 0, 0, rect.width, rect.height);
      } else {
        throw new Error('Image not loaded or has zero dimensions');
      }
    } catch (error) {
      console.warn('Canvas Weaver: Cannot draw image due to CORS or loading issues:', error);
      // Fill with placeholder
      ctx.fillStyle = '#f0f4ff';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = '#007ACC';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🌊 Image Element', rect.width / 2, rect.height / 2 - 5);
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText('(CORS restricted)', rect.width / 2, rect.height / 2 + 10);
    }
  } else if (element.tagName === 'CANVAS') {
    try {
      ctx.drawImage(element, 0, 0, rect.width, rect.height);
    } catch (error) {
      console.warn('Canvas Weaver: Cannot draw canvas due to CORS issues:', error);
      // Fill with placeholder
      ctx.fillStyle = '#f0f4ff';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = '#007ACC';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🌊 Canvas Element', rect.width / 2, rect.height / 2 - 5);
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText('(CORS restricted)', rect.width / 2, rect.height / 2 + 10);
    }
  } else if (element.tagName === 'SVG') {
    // Convert SVG to image
    const svgData = new XMLSerializer().serializeToString(element);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        URL.revokeObjectURL(svgUrl);
        resolve(getCanvasData(canvas, element, rect));
      };
      img.src = svgUrl;
    });
  } else {
    // For background images and other elements, use html2canvas approach
    return captureElementWithHtml2Canvas(element, rect);
  }
  
  return getCanvasData(canvas, element, rect);
}

/**
 * Get canvas data and metadata
 */
function getCanvasData(canvas, element, rect) {
  let dataUrl;
  let isFallback = false;
  
  try {
    // Try to export canvas data
    dataUrl = canvas.toDataURL('image/png', 0.95);
  } catch (error) {
    isFallback = true;
    console.warn('Canvas Weaver: Canvas is tainted, creating fallback representation:', error);
    
    // Create a clean canvas with a placeholder
    const fallbackCanvas = document.createElement('canvas');
    const fallbackCtx = fallbackCanvas.getContext('2d');
    
    fallbackCanvas.width = rect.width;
    fallbackCanvas.height = rect.height;
    
    // Fill with a gradient background
    const gradient = fallbackCtx.createLinearGradient(0, 0, rect.width, rect.height);
    gradient.addColorStop(0, '#f0f4ff');
    gradient.addColorStop(1, '#e0e7ff');
    fallbackCtx.fillStyle = gradient;
    fallbackCtx.fillRect(0, 0, rect.width, rect.height);
    
    // Add border
    fallbackCtx.strokeStyle = '#007ACC';
    fallbackCtx.lineWidth = 2;
    fallbackCtx.strokeRect(1, 1, rect.width - 2, rect.height - 2);
    
    // Add text indicating it's a captured element
    fallbackCtx.fillStyle = '#007ACC';
    fallbackCtx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    fallbackCtx.textAlign = 'center';
    fallbackCtx.fillText('🌊 Captured Element', rect.width / 2, rect.height / 2 - 10);
    
    // Add element type
    fallbackCtx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    fallbackCtx.fillStyle = '#666';
    fallbackCtx.fillText(element.tagName.toLowerCase(), rect.width / 2, rect.height / 2 + 10);
    
    // Add dimensions
    fallbackCtx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    fallbackCtx.fillText(`${Math.round(rect.width)} × ${Math.round(rect.height)}px`, rect.width / 2, rect.height / 2 + 25);
    
    dataUrl = fallbackCanvas.toDataURL('image/png', 0.95);
  }
  
  return {
    dataUrl: dataUrl,
    width: rect.width,
    height: rect.height,
    metadata: {
      tagName: element.tagName,
      src: element.src || null,
      alt: element.alt || null,
      className: element.className,
      id: element.id,
      timestamp: Date.now(),
      url: window.location.href,
      position: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      },
      isFallback: isFallback
    }
  };
}

/**
 * Fallback capture using html2canvas-like approach
 */
async function captureElementWithHtml2Canvas(element, rect) {
  // Simple fallback - just capture the element's rendered appearance
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = rect.width;
  canvas.height = rect.height;
  
  // Fill with element's background
  const style = window.getComputedStyle(element);
  ctx.fillStyle = style.backgroundColor || '#ffffff';
  ctx.fillRect(0, 0, rect.width, rect.height);
  
  // If it has a background image, try to draw it
  if (style.backgroundImage && style.backgroundImage !== 'none') {
    const imageUrl = style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
    if (imageUrl && imageUrl[1]) {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          resolve(getCanvasData(canvas, element, rect));
        };
        img.onerror = () => {
          resolve(getCanvasData(canvas, element, rect));
        };
        img.src = imageUrl[1];
      });
    }
  }
  
  return getCanvasData(canvas, element, rect);
}

/**
 * Remove all overlays
 */
function removeAllOverlays() {
  overlayElements.forEach(overlay => {
    // Remove event listeners
    const element = overlay._canvasWeaverElement;
    const handler = overlay._canvasWeaverCaptureHandler;
    
    if (element && handler) {
      element.removeEventListener('click', handler, true);
    }
    
    // Remove overlay element
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  });
  
  overlayElements = [];
}

/**
 * Set up mutation observer for dynamic content
 */
function setupMutationObserver() {
  if (window.canvasWeaverObserver) {
    window.canvasWeaverObserver.disconnect();
  }
  
  window.canvasWeaverObserver = new MutationObserver((mutations) => {
    if (!isAutoScanning) return;
    
    let shouldRescan = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if new node contains images
            if (node.tagName === 'IMG' || node.querySelector('img, canvas, svg')) {
              shouldRescan = true;
            }
          }
        });
      }
    });
    
    if (shouldRescan) {
      // Debounce rescanning
      clearTimeout(window.canvasWeaverRescanTimeout);
      window.canvasWeaverRescanTimeout = setTimeout(() => {
        scanForImages();
      }, 500);
    }
  });
  
  window.canvasWeaverObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Inject CSS styles for overlays
 */
function injectAutoScanStyles() {
  if (document.getElementById('canvas-weaver-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'canvas-weaver-styles';
  style.textContent = `
    .canvas-weaver-overlay {
      position: absolute;
      border: 3px solid #007ACC;
      border-radius: 4px;
      background: rgba(0, 122, 204, 0.1);
      backdrop-filter: blur(1px);
      opacity: 0;
      transition: all 0.3s ease;
      cursor: pointer;
      pointer-events: none;
      box-shadow: 0 2px 10px rgba(0, 122, 204, 0.3);
    }
    
    .canvas-weaver-overlay:hover {
      border-color: #0066CC;
      background: rgba(0, 122, 204, 0.2);
      box-shadow: 0 4px 20px rgba(0, 122, 204, 0.4);
    }
    
    .canvas-weaver-overlay::before {
      content: '🌊 Click to convert';
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      background: #007ACC;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
      z-index: 1000000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .canvas-weaver-overlay:hover::before {
      opacity: 1;
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Show page notification to user
 */
function showPageNotification(message) {
  // Remove existing notification
  const existing = document.getElementById('canvas-weaver-notification');
  if (existing) {
    existing.remove();
  }
  
  // Create notification
  const notification = document.createElement('div');
  notification.id = 'canvas-weaver-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #007ACC;
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 2147483647;
    max-width: 350px;
    box-shadow: 0 4px 20px rgba(0, 122, 204, 0.4);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.4;
    border: 2px solid rgba(255, 255, 255, 0.2);
    animation: canvas-weaver-slide-in 0.3s ease-out;
  `;
  notification.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 10px;">
      <span style="font-size: 18px;">🌊</span>
      <div style="flex: 1;">
        <div style="font-weight: 600; margin-bottom: 4px;">Canvas Weaver</div>
        <div style="opacity: 0.9;">${message}</div>
      </div>
      <span style="cursor: pointer; opacity: 0.7; hover: opacity: 1;" onclick="this.parentElement.parentElement.remove()">×</span>
    </div>
  `;
  
  // Add animation keyframes if not already added
  if (!document.getElementById('canvas-weaver-animations')) {
    const animationStyle = document.createElement('style');
    animationStyle.id = 'canvas-weaver-animations';
    animationStyle.textContent = `
      @keyframes canvas-weaver-slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(animationStyle);
  }
  
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'canvas-weaver-slide-in 0.3s ease-out reverse';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  }, 5000);
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (isAutoScanning) {
    stopAutoScan();
  }
});

console.log('Canvas Weaver auto-scan content script initialized');

})(); // End of IIFE