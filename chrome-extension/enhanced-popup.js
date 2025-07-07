/**
 * Enhanced Popup Script for Sticker Component Analyzer
 * Supports new capture and selection features
 */

document.addEventListener('DOMContentLoaded', function() {
  // Auto-Scan UI elements
  const scanStatusEl = document.getElementById('scanStatus');
  const imageCountEl = document.getElementById('imageCount');
  const toggleScanBtn = document.getElementById('toggleScan');
  const refreshScanBtn = document.getElementById('refreshScan');
  
  // Existing elements
  const statusEl = document.getElementById('status');
  const loadingEl = document.getElementById('loading');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const successMessage = document.getElementById('success-message');
  const componentsContainerEl = document.getElementById('components-container');
  
  // Auto-scan state
  let isScanning = false;
  let imageCount = 0;
  let capturedComponents = [];
  let contentScriptReady = false;
  
  // Capture options optimized for auto-scanning
  let captureOptions = {
    highDPI: true,
    includeShadowDOM: true,
    includeCrossOrigin: true,
    quality: 0.95,
    autoClipboard: true
  };
  
  // Test DOM element access
  console.log('DOM elements found:');
  console.log('toggleScanBtn:', !!toggleScanBtn);
  console.log('refreshScanBtn:', !!refreshScanBtn);
  console.log('scanStatusEl:', !!scanStatusEl);
  console.log('imageCountEl:', !!imageCountEl);
  console.log('statusEl:', !!statusEl);

  // Initialize popup
  initializeAutoScanPopup();
  
  // Keep popup alive during processing
  setupKeepAlive();
  
  /**
   * Set up keep alive functionality
   */
  function setupKeepAlive() {
    // Send periodic keep-alive messages to background script
    setInterval(() => {
      if (chrome && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({ action: 'keep_alive' }).catch(() => {
          // Ignore errors if background script is not available
        });
      }
    }, 25000); // Every 25 seconds (Chrome allows 30s max)
  }
  
  /**
   * Initialize auto-scan popup functionality
   */
  function initializeAutoScanPopup() {
    statusEl.textContent = "Initializing Canvas Weaver...";
    
    // Check WebSocket connection status
    checkWebSocketConnection();
    
    // Set up button event listeners
    setupButtonListeners();
    
    // Wait for content script to be ready before starting auto-scan
    waitForContentScriptReady();
    
    // Listen for messages
    chrome.runtime.onMessage.addListener(handleAutoScanMessages);
    
    // Check content script status
    checkContentScriptStatus();
  }
  
  /**
   * Set up button event listeners
   */
  function setupButtonListeners() {
    if (toggleScanBtn) {
      toggleScanBtn.addEventListener('click', toggleAutoScan);
      console.log('Toggle scan button event listener added');
    } else {
      console.error('toggleScanBtn element not found');
    }
    
    if (refreshScanBtn) {
      refreshScanBtn.addEventListener('click', refreshScan);
      console.log('Refresh scan button event listener added');
    } else {
      console.error('refreshScanBtn element not found');
    }
  }
  
  /**
   * Start auto-scanning for images
   */
  function startAutoScan() {
    if (!contentScriptReady) {
      statusEl.textContent = "Waiting for content script to be ready...";
      return;
    }
    
    isScanning = true;
    updateScanUI();
    statusEl.textContent = "Auto-scanning page for convertible images...";
    
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) {
        statusEl.textContent = "Extension context error - please reload the extension";
        return;
      }
      
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
          console.error("Error querying tabs:", chrome.runtime.lastError);
          statusEl.textContent = "Error: Could not access active tab";
          return;
        }
        
        if (!tabs || !tabs[0]) {
          console.error("No active tab found");
          statusEl.textContent = "Error: No active tab found";
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "START_AUTO_SCAN",
          options: captureOptions
        }, function(response) {
          if (chrome.runtime.lastError) {
            statusEl.textContent = "Error: Could not connect to page. Try refreshing.";
            const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
            console.error("Error starting auto-scan:", errorMsg);
            statusEl.textContent = "Error: " + errorMsg;
            return;
          }
          
          if (response && response.success) {
            statusEl.textContent = "Hover over highlighted images to see them, click to capture";
          } else {
            statusEl.textContent = "Failed to start auto-scan mode";
            console.error("Auto-scan start failed:", response);
          }
        });
      });
    } catch (error) {
      console.error("Exception in startAutoScan:", error);
      statusEl.textContent = "Error: Extension context issue. Try reloading the extension.";
    }
  }
  
  /**
   * Stop auto-scanning
   */
  function stopAutoScan() {
    isScanning = false;
    updateScanUI();
    statusEl.textContent = "Auto-scan stopped";
    
    try {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
          console.error("Error querying tabs:", chrome.runtime.lastError);
          return;
        }
        
        if (!tabs || !tabs[0]) {
          console.error("No active tab found");
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "STOP_AUTO_SCAN"
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error("Error stopping auto-scan:", chrome.runtime.lastError);
          }
        });
      });
    } catch (error) {
      console.error("Exception in stopAutoScan:", error);
    }
  }
  
  /**
   * Toggle auto-scanning
   */
  function toggleAutoScan() {
    if (isScanning) {
      stopAutoScan();
    } else {
      startAutoScan();
    }
  }
  
  /**
   * Refresh scan
   */
  function refreshScan() {
    if (isScanning) {
      stopAutoScan();
      setTimeout(startAutoScan, 100);
    } else {
      startAutoScan();
    }
  }
  
  /**
   * Update scan UI elements
   */
  function updateScanUI() {
    if (toggleScanBtn) {
      const buttonText = toggleScanBtn.querySelector('.button-text');
      const buttonIcon = toggleScanBtn.querySelector('.button-icon');
      
      if (buttonText && buttonIcon) {
        if (isScanning) {
          buttonText.textContent = 'Stop Scanning';
          buttonIcon.textContent = '🛑';
          toggleScanBtn.className = 'action-button primary';
        } else {
          buttonText.textContent = 'Start Scanning';
          buttonIcon.textContent = '👁️';
          toggleScanBtn.className = 'action-button secondary';
        }
      }
    }
    
    // Update scan status
    if (scanStatusEl) {
      const title = scanStatusEl.querySelector('.scan-title');
      const description = scanStatusEl.querySelector('.scan-description');
      
      if (title && description) {
        if (isScanning) {
          title.textContent = 'Auto-Scanning Page';
          description.textContent = 'Hover over images to highlight them';
        } else {
          title.textContent = 'Scan Stopped';
          description.textContent = 'Click "Start Scanning" to begin';
        }
      }
    }
  }
  
  /**
   * Update image count display
   */
  function updateImageCount(count) {
    imageCount = count;
    if (imageCountEl) {
      imageCountEl.textContent = count;
    }
  }
  
  // Note: Enhanced mode functions removed as they reference undefined elements
  
  /**
   * Check WebSocket connection status
   */
  function checkWebSocketConnection() {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) {
        updateConnectionStatus(false, 'error');
        return;
      }
      
      chrome.runtime.sendMessage({ action: 'get_connection_status' }, function(response) {
        if (chrome.runtime.lastError) {
          console.error("Error checking WebSocket connection:", chrome.runtime.lastError);
          updateConnectionStatus(false, 'error');
          return;
        }
        
        if (response) {
          updateConnectionStatus(response.connected, response.state);
        } else {
          updateConnectionStatus(false, 'error');
        }
      });
    } catch (error) {
      console.error("Exception in checkWebSocketConnection:", error);
      updateConnectionStatus(false, 'error');
    }
  }
  
  /**
   * Update connection status in UI
   */
  function updateConnectionStatus(connected, state) {
    const connectionIndicator = document.getElementById('connection-status');
    if (connectionIndicator) {
      if (connected) {
        connectionIndicator.textContent = '🟢 Connected to Figma';
        connectionIndicator.className = 'connection-status connected';
      } else {
        connectionIndicator.textContent = '🔴 Chrome extension not connected';
        connectionIndicator.className = 'connection-status disconnected';
      }
    }
    
    // Update main status if not busy with other operations
    if (statusEl && statusEl.textContent.includes('Initializing')) {
      statusEl.textContent = connected 
        ? 'Extension ready - WebSocket connected to Figma'
        : 'Extension ready - Waiting for Figma connection';
    }
  }

  /**
   * Handle auto-scan messages from content script
   */
  function handleAutoScanMessages(message, sender, sendResponse) {
    console.log('Auto-scan popup received message:', message.action);
    
    switch (message.action) {
      case 'websocket_status':
        updateConnectionStatus(message.connected, message.state);
        break;
        
      case 'component_ready':
        handleComponentReady(message.data);
        break;
        
      case 'AUTO_SCAN_STARTED':
        handleScanStarted(message.data);
        break;
        
      case 'AUTO_SCAN_STOPPED':
        handleScanStopped();
        break;
        
      case 'IMAGE_COUNT_UPDATED':
        updateImageCount(message.count);
        break;
        
      case 'IMAGE_CAPTURED':
        handleImageCaptured(message.data);
        break;
        
      case 'CAPTURE_COMPLETE':
        handleCaptureComplete(message.data);
        break;
        
      case 'CAPTURE_ERROR':
        handleCaptureError(message.error);
        break;
        
      case 'enhanced_ready':
        handleEnhancedReady(message.features);
        break;
        
      case 'ENHANCED_SELECTION_STARTED':
        handleSelectionStarted(message.options);
        break;
        
      case 'ENHANCED_SELECTION_STOPPED':
        handleSelectionStopped();
        break;
        
      case 'ENHANCED_ELEMENT_CAPTURED':
        handleElementCaptured(message.data);
        break;
        
      case 'ENHANCED_CAPTURE_COMPLETE':
        handleCaptureComplete(message.data);
        break;
        
      case 'ENHANCED_CAPTURE_ERROR':
        handleCaptureError(message.error);
        break;
        
      default:
        // Handle legacy messages
        handleLegacyMessages(message, sender, sendResponse);
        break;
    }
  }
  
  /**
   * Handle component ready from Figma
   */
  function handleComponentReady(data) {
    showSuccess('Component processed successfully in Figma!');
    statusEl.textContent = 'Component ready in Figma - press Cmd+V (Mac) or Ctrl+V (Windows) to paste';
    console.log('Component ready in Figma:', data);
  }
  
  /**
   * Handle scan started
   */
  function handleScanStarted(data) {
    isScanning = true;
    updateScanUI();
    updateImageCount(data.imageCount || 0);
    statusEl.textContent = 'Auto-scan active - hover over images to highlight them';
  }
  
  /**
   * Handle scan stopped
   */
  function handleScanStopped() {
    isScanning = false;
    updateScanUI();
    statusEl.textContent = 'Auto-scan stopped';
  }
  
  /**
   * Handle image captured
   */
  function handleImageCaptured(data) {
    showProgress();
    updateProgress(50);
    statusEl.textContent = 'Processing image with AI...';
    
    // Send to WebSocket for processing
    sendImageToFigma(data);
  }
  
  /**
   * Show progress state
   */
  function showProgress() {
    if (progressContainer) progressContainer.style.display = 'block';
    if (loadingEl) loadingEl.style.display = 'block';
  }
  
  /**
   * Handle capture complete
   */
  function handleCaptureComplete(data) {
    hideProgress();
    showSuccess('Image captured and sent to Figma!');
    statusEl.textContent = 'Go to Figma and press Cmd+V (Mac) or Ctrl+V (Windows) to paste your component';
  }
  
  /**
   * Handle capture error
   */
  function handleCaptureError(error) {
    hideProgress();
    const errorMsg = typeof error === 'object' ? (error.message || JSON.stringify(error)) : error;
    statusEl.textContent = `Capture failed: ${errorMsg}`;
    console.error('Auto-scan capture error:', error);
  }
  
  /**
   * Send captured image to Figma via WebSocket
   */
  function sendImageToFigma(imageData) {
    if (!chrome || !chrome.runtime || !chrome.runtime.id) {
      hideProgress();
      statusEl.textContent = 'Extension context error - please reload the extension';
      return;
    }
    
    chrome.runtime.sendMessage({
      action: 'send_component_data',
      data: {
        type: 'image_capture',
        imageData: imageData.dataUrl,
        metadata: imageData.metadata,
        timestamp: Date.now(),
        source: 'auto-scan'
      }
    }, function(response) {
      if (chrome.runtime.lastError) {
        hideProgress();
        statusEl.textContent = 'Failed to send to Figma - extension error';
        console.error('Extension error:', chrome.runtime.lastError);
        return;
      }
      
      if (response && response.success) {
        updateProgress(100);
        setTimeout(() => {
          hideProgress();
          showSuccess('Image sent to Figma successfully!');
          statusEl.textContent = 'Component ready - go to Figma and press Cmd+V or Ctrl+V to paste';
        }, 500);
      } else {
        hideProgress();
        statusEl.textContent = 'Failed to send to Figma - WebSocket not connected';
        console.error('Failed to send image to Figma');
      }
    });
  }

  /**
   * Handle enhanced ready status
   */
  function handleEnhancedReady(features) {
    if (features.enhancedCapture && features.enhancedSelection) {
      statusEl.textContent = "Enhanced features ready";
    } else {
      statusEl.textContent = "Enhanced features not available - using standard mode";
    }
  }
  
  /**
   * Handle selection started
   */
  function handleSelectionStarted(options) {
    const modeText = options.multiSelect ? "multi-element" : "single-element";
    statusEl.textContent = `Enhanced ${modeText} selection active`;
  }
  
  /**
   * Handle selection stopped
   */
  function handleSelectionStopped() {
    statusEl.textContent = "Selection stopped";
  }
  
  /**
   * Handle element captured
   */
  function handleElementCaptured(data) {
    const progress = ((data.index + 1) / data.total) * 100;
    updateProgress(progress);
    
    statusEl.textContent = `Capturing element ${data.index + 1} of ${data.total}...`;
    
    // Add to components container
    addCapturedComponent({
      imageData: data.imageData,
      width: data.width,
      height: data.height,
      metadata: data.metadata
    });
  }
  
  /**
   * Wait for content script to be ready before starting auto-scan
   */
  function waitForContentScriptReady() {
    const maxAttempts = 10;
    let attempts = 0;
    
    function checkContentScript() {
      attempts++;
      
      if (!chrome || !chrome.runtime || !chrome.runtime.id) {
        statusEl.textContent = "Extension context error - please reload the extension";
        return;
      }
      
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError || !tabs || !tabs[0]) {
          if (attempts < maxAttempts) {
            setTimeout(checkContentScript, 500);
          } else {
            statusEl.textContent = "Could not access active tab - please refresh the page";
          }
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {action: "STATUS_CHECK"}, function(response) {
          if (chrome.runtime.lastError) {
            if (attempts < maxAttempts) {
              setTimeout(checkContentScript, 500);
            } else {
              statusEl.textContent = "Content script not ready - please refresh the page";
            }
          } else if (response && response.success) {
            contentScriptReady = true;
            startAutoScan();
          }
        });
      });
    }
    
    checkContentScript();
  }
  
  /**
   * Handle capture complete
   */
  function handleCaptureComplete(data) {
    hideProgress();
    showSuccess(`Successfully captured ${data.totalElements} element${data.totalElements > 1 ? 's' : ''}!`);
    
    statusEl.textContent = `Capture complete - ${data.totalElements} elements ready for Figma`;
    
    // Send to Figma
    sendComponentsToFigma();
  }
  
  /**
   * Handle legacy messages for backward compatibility
   */
  function handleLegacyMessages(message, sender, sendResponse) {
    // Implement legacy message handling here
    console.log('Legacy message:', message.action);
  }
  
  /**
   * Check content script status
   */
  function checkContentScriptStatus() {
    try {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (chrome.runtime.lastError) {
          console.error("Error querying tabs for status check:", chrome.runtime.lastError);
          return;
        }
        
        if (!tabs || !tabs[0]) {
          console.error("No active tab found for status check");
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {action: "STATUS_CHECK"}, function(response) {
          if (chrome.runtime.lastError) {
            console.log("Content script not ready:", chrome.runtime.lastError.message);
            statusEl.textContent = "Content script not ready - please refresh the page";
          } else if (response && response.success) {
            console.log("Content script ready, auto-scan:", response.autoScan, "images:", response.imageCount);
          }
        });
      });
    } catch (error) {
      console.error("Exception in checkContentScriptStatus:", error);
    }
  }
  
  /**
   * Add captured component to UI
   */
  function addCapturedComponent(component) {
    if (!componentsContainerEl) return;
    
    const componentEl = document.createElement('div');
    componentEl.className = 'captured-component';
    componentEl.innerHTML = `
      <img src="${component.imageData}" alt="Captured component" style="max-width: 100%; height: auto; border-radius: 4px;">
      <div class="component-info">
        <small>${component.width}×${component.height}px</small>
        ${component.metadata ? `<small>${new Date(component.metadata.timestamp).toLocaleTimeString()}</small>` : ''}
      </div>
    `;
    
    componentsContainerEl.appendChild(componentEl);
    componentsContainerEl.style.display = 'block';
  }
  
  /**
   * Send components to Figma
   */
  function sendComponentsToFigma() {
    if (capturedComponents.length === 0) {
      statusEl.textContent = 'No components to send to Figma';
      return;
    }
    
    if (!chrome || !chrome.runtime || !chrome.runtime.id) {
      statusEl.textContent = 'Extension context error - please reload the extension';
      return;
    }

    statusEl.textContent = 'Sending components to Figma via WebSocket...';
    
    // Send component data through background script WebSocket
    chrome.runtime.sendMessage({
      action: 'send_component_data',
      data: {
        components: capturedComponents,
        timestamp: Date.now(),
        source: 'chrome-extension'
      }
    }, function(response) {
      if (chrome.runtime.lastError) {
        statusEl.textContent = 'Failed to send components - extension error';
        console.error('Extension error:', chrome.runtime.lastError);
        return;
      }
      
      if (response && response.success) {
        statusEl.textContent = 'Components sent to Figma successfully!';
        showSuccess('Components are being processed in Figma');
      } else {
        statusEl.textContent = 'Failed to send components - WebSocket not connected';
        console.error('Failed to send components to Figma');
      }
    });
  }
  
  /**
   * Show loading state
   */
  function showLoading() {
    if (loadingEl) loadingEl.style.display = 'block';
  }
  
  /**
   * Hide loading state
   */
  function hideLoading() {
    if (loadingEl) loadingEl.style.display = 'none';
  }
  
  /**
   * Update progress bar
   */
  function updateProgress(percent) {
    if (progressContainer) progressContainer.style.display = 'block';
    if (progressBar) progressBar.style.width = percent + '%';
  }
  
  /**
   * Hide progress bar
   */
  function hideProgress() {
    if (progressContainer) progressContainer.style.display = 'none';
  }
  
  /**
   * Show success message
   */
  function showSuccess(message) {
    if (successMessage) {
      successMessage.textContent = message;
      successMessage.style.display = 'block';
      setTimeout(() => {
        successMessage.style.display = 'none';
      }, 3000);
    }
  }
});

console.log('Enhanced popup script loaded');