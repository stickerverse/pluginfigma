/**
 * Enhanced Popup Script for Sticker Component Analyzer
 * Supports new capture and selection features
 */

document.addEventListener('DOMContentLoaded', function() {
  // Enhanced UI elements
  const enhancedModeToggle = document.getElementById('enhanced-mode-toggle');
  const multiSelectToggle = document.getElementById('multi-select-toggle');
  const highDpiToggle = document.getElementById('high-dpi-toggle');
  const shadowDomToggle = document.getElementById('shadow-dom-toggle');
  const crossOriginToggle = document.getElementById('cross-origin-toggle');
  const previewToggle = document.getElementById('preview-toggle');
  
  // Existing elements
  const startCaptureBtn = document.getElementById('start-capture');
  const statusEl = document.getElementById('status');
  const loadingEl = document.getElementById('loading');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const successMessage = document.getElementById('success-message');
  const componentsContainerEl = document.getElementById('components-container');
  
  // Enhanced state
  let enhancedMode = true;
  let captureOptions = {
    multiSelect: false,
    highDPI: true,
    includeShadowDOM: true,
    includeCrossOrigin: true,
    showPreview: true,
    confirmCapture: true,
    quality: 0.95
  };
  
  // Legacy state
  let capturedComponents = [];
  let componentData = null;
  let clipboardReady = false;
  
  // Initialize popup
  initializeEnhancedPopup();
  
  /**
   * Initialize enhanced popup functionality
   */
  function initializeEnhancedPopup() {
    statusEl.textContent = "Initializing enhanced extension...";
    
    // Set up enhanced mode toggle
    if (enhancedModeToggle) {
      enhancedModeToggle.checked = enhancedMode;
      enhancedModeToggle.addEventListener('change', toggleEnhancedMode);
    }
    
    // Set up capture option toggles
    if (multiSelectToggle) {
      multiSelectToggle.checked = captureOptions.multiSelect;
      multiSelectToggle.addEventListener('change', () => {
        captureOptions.multiSelect = multiSelectToggle.checked;
        updateCaptureButtonText();
      });
    }
    
    if (highDpiToggle) {
      highDpiToggle.checked = captureOptions.highDPI;
      highDpiToggle.addEventListener('change', () => {
        captureOptions.highDPI = highDpiToggle.checked;
      });
    }
    
    if (shadowDomToggle) {
      shadowDomToggle.checked = captureOptions.includeShadowDOM;
      shadowDomToggle.addEventListener('change', () => {
        captureOptions.includeShadowDOM = shadowDomToggle.checked;
      });
    }
    
    if (crossOriginToggle) {
      crossOriginToggle.checked = captureOptions.includeCrossOrigin;
      crossOriginToggle.addEventListener('change', () => {
        captureOptions.includeCrossOrigin = crossOriginToggle.checked;
      });
    }
    
    if (previewToggle) {
      previewToggle.checked = captureOptions.showPreview;
      previewToggle.addEventListener('change', () => {
        captureOptions.showPreview = previewToggle.checked;
      });
    }
    
    // Enhanced capture button
    if (startCaptureBtn) {
      startCaptureBtn.addEventListener('click', startEnhancedCapture);
    }
    
    // Listen for messages
    chrome.runtime.onMessage.addListener(handleEnhancedMessages);
    
    // Check content script status
    checkContentScriptStatus();
    
    updateCaptureButtonText();
  }
  
  /**
   * Toggle enhanced mode
   */
  function toggleEnhancedMode() {
    enhancedMode = enhancedModeToggle.checked;
    
    // Show/hide enhanced options
    const enhancedOptions = document.getElementById('enhanced-options');
    if (enhancedOptions) {
      enhancedOptions.style.display = enhancedMode ? 'block' : 'none';
    }
    
    updateCaptureButtonText();
    
    // Update status
    statusEl.textContent = enhancedMode 
      ? "Enhanced mode enabled - Advanced capture features available"
      : "Standard mode - Basic capture functionality";
  }
  
  /**
   * Start enhanced capture workflow
   */
  function startEnhancedCapture() {
    if (enhancedMode) {
      startEnhancedSelection();
    } else {
      startLegacyCapture();
    }
  }
  
  /**
   * Start enhanced element selection
   */
  function startEnhancedSelection() {
    statusEl.textContent = captureOptions.multiSelect 
      ? "Select multiple elements (click to select, Enter to capture, Escape to cancel)"
      : "Click on an element to capture (Escape to cancel)";
    
    showLoading();
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "START_ENHANCED_SELECTION",
        options: captureOptions
      }, function(response) {
        if (chrome.runtime.lastError) {
          statusEl.textContent = "Error: Could not connect to page. Try refreshing.";
          hideLoading();
          console.error("Error starting enhanced selection:", chrome.runtime.lastError);
          return;
        }
        
        if (response && response.success) {
          statusEl.textContent = "Enhanced selection mode active";
          hideLoading();
          
          // Update button to stop selection
          startCaptureBtn.textContent = "Stop Selection";
          startCaptureBtn.onclick = stopEnhancedSelection;
        } else {
          statusEl.textContent = "Failed to start enhanced selection";
          hideLoading();
        }
      });
    });
  }
  
  /**
   * Stop enhanced element selection
   */
  function stopEnhancedSelection() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "STOP_ENHANCED_SELECTION"
      }, function(response) {
        statusEl.textContent = "Selection stopped";
        
        // Restore button
        updateCaptureButtonText();
        startCaptureBtn.onclick = startEnhancedCapture;
      });
    });
  }
  
  /**
   * Start legacy capture for backward compatibility
   */
  function startLegacyCapture() {
    statusEl.textContent = "Hover over any component or image and click to capture";
    showLoading();
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "START_COMPONENT_CAPTURE"}, function(response) {
        if (chrome.runtime.lastError) {
          statusEl.textContent = "Error: Could not connect to page. Try refreshing.";
          hideLoading();
          console.error("Error starting component capture:", chrome.runtime.lastError);
          return;
        }
        
        if (response && response.success) {
          statusEl.textContent = "Hover and click on a component to capture";
          hideLoading();
        } else {
          statusEl.textContent = "Failed to start capture mode";
          hideLoading();
        }
      });
    });
  }
  
  /**
   * Handle enhanced messages from content script
   */
  function handleEnhancedMessages(message, sender, sendResponse) {
    console.log('Enhanced popup received message:', message.action);
    
    switch (message.action) {
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
   * Handle enhanced ready status
   */
  function handleEnhancedReady(features) {
    if (features.enhancedCapture && features.enhancedSelection) {
      statusEl.textContent = "Enhanced features ready";
      startCaptureBtn.disabled = false;
    } else {
      statusEl.textContent = "Enhanced features not available - using standard mode";
      enhancedMode = false;
      if (enhancedModeToggle) {
        enhancedModeToggle.checked = false;
        enhancedModeToggle.disabled = true;
      }
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
    updateCaptureButtonText();
    startCaptureBtn.onclick = startEnhancedCapture;
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
   * Handle capture error
   */
  function handleCaptureError(error) {
    hideProgress();
    statusEl.textContent = `Capture failed: ${error}`;
    console.error('Enhanced capture error:', error);
  }
  
  /**
   * Handle legacy messages for backward compatibility
   */
  function handleLegacyMessages(message, sender, sendResponse) {
    // Implement legacy message handling here
    console.log('Legacy message:', message.action);
  }
  
  /**
   * Update capture button text
   */
  function updateCaptureButtonText() {
    if (!startCaptureBtn) return;
    
    if (enhancedMode) {
      const modeText = captureOptions.multiSelect ? "Select Multiple Elements" : "Select Element";
      startCaptureBtn.textContent = modeText;
    } else {
      startCaptureBtn.textContent = "Start Capture";
    }
  }
  
  /**
   * Check content script status
   */
  function checkContentScriptStatus() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "STATUS_CHECK"}, function(response) {
        if (chrome.runtime.lastError) {
          statusEl.textContent = "Content script not ready - please refresh the page";
          startCaptureBtn.disabled = true;
        }
      });
    });
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
    // Implementation depends on existing Figma integration
    console.log('Sending components to Figma...');
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