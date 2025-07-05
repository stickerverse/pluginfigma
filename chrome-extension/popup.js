/**
 * Sticker Component Analyzer - Popup Script
 * Controls the extension popup UI and communicates with the content script
 */

document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const startCaptureBtn = document.getElementById('start-capture');
  const statusEl = document.getElementById('status');
  const loadingEl = document.getElementById('loading');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const successMessage = document.getElementById('success-message');
  const componentsContainerEl = document.getElementById('components-container');
  
  // State
  let capturedComponents = [];
  let componentData = null;
  let clipboardReady = false;
  
  // Initially show status as initializing
  statusEl.textContent = "Initializing extension...";
  
  // Event listener for the main capture button
  startCaptureBtn.addEventListener('click', function() {
    debugLog('Start capture button clicked');
    startComponentCapture();
  });
  
  // Listen for messages from content script and background script
  chrome.runtime.onMessage.addListener(handleExtensionMessages);
  
  // Initialize popup state
  initializePopup();
  
  /**
   * Start the streamlined component capture workflow
   */
  function startComponentCapture() {
    statusEl.textContent = "Hover over any component or image and click to capture";
    showLoading();
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "START_COMPONENT_CAPTURE"}, function(response) {
        if (chrome.runtime.lastError) {
          statusEl.textContent = "Error: Could not connect to page. Try refreshing.";
          hideLoading();
          debugLog("Error starting component capture:", chrome.runtime.lastError);
          return;
        }
        
        debugLog("Component capture started response:", response);
        
        if (response && response.success) {
          window.close(); // Close popup to give user full view of the page
        } else {
          statusEl.textContent = response?.error || "Unknown error starting capture";
          hideLoading();
        }
      });
    });
  }

  /**
   * Initialize the popup state and check if the content script is ready
   */
  function initializePopup() {
    // Check current tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTab = tabs[0];
      
      // Check if we're on a Figma tab
      if (currentTab.url && currentTab.url.includes('figma.com')) {
        activeFigmaTab = currentTab;
        statusEl.textContent = "Figma detected! Components can be sent directly.";
      } else {
        // Check if inspection is already active on this tab
        checkContentScriptStatus(currentTab);
      }
    });
    
    // Load previously captured components from storage
    chrome.storage.local.get(['capturedComponents'], function(result) {
      if (result.capturedComponents && result.capturedComponents.length > 0) {
        capturedComponents = result.capturedComponents;
        updateComponentsList();
        if (sendToFigmaBtn) sendToFigmaBtn.disabled = false;
      } else {
        if (sendToFigmaBtn) sendToFigmaBtn.disabled = true;
      }
    });
  }
  
  /**
   * Check if the content script is loaded and ready
   */
  function checkContentScriptStatus(tab) {
    chrome.tabs.sendMessage(tab.id, {action: "GET_INSPECTION_STATUS"}, function(response) {
      if (chrome.runtime.lastError) {
        // Content script might not be loaded yet
        console.log("Content script not ready:", chrome.runtime.lastError);
        statusEl.textContent = "Waiting for page to load...";
        return;
      }
      
      // Content script is ready
      statusEl.textContent = "Ready! Click 'Inspect UI Elements' to start.";
      
      if (response && response.isInspecting) {
        isInspecting = true;
        if (inspectBtn) {
          inspectBtn.textContent = "Stop Inspection";
          inspectBtn.style.backgroundColor = "#e74c3c";
        }
        statusEl.textContent = "Inspection active. Click on elements to analyze.";
      }
    });
  }

  /**
   * Toggle element inspection mode on the current page
   */
  function toggleInspection() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0] || !tabs[0].id) {
        statusEl.textContent = "Error: Cannot access active tab";
        console.error("Error accessing active tab", tabs);
        return;
      }
      
      const action = isInspecting ? "STOP_INSPECTION" : "START_INSPECTION";
      statusEl.textContent = isInspecting ? "Stopping inspection..." : "Starting inspection...";
      
      try {
        // First try to inject a content script if it's not already there
        chrome.scripting.executeScript(
          {
            target: {tabId: tabs[0].id},
            files: ['content-script.js']
          },
          function(injectionResults) {
            // After script injection (or if it was already injected), send the message
            chrome.tabs.sendMessage(tabs[0].id, {action: action}, function(response) {
              if (chrome.runtime.lastError) {
                const errorMessage = chrome.runtime.lastError.message || "Unknown error";
                statusEl.textContent = `Error: Could not connect to page. ${errorMessage}. Try refreshing.`;
                console.error("Error toggling inspection:", chrome.runtime.lastError);
                return;
              }
              
              console.log("Toggle inspection response:", response);
              
              if (response && response.success) {
                isInspecting = !isInspecting;
                
                if (inspectBtn) {
                  if (isInspecting) {
                    inspectBtn.textContent = "Stop Inspection";
                    inspectBtn.style.backgroundColor = "#e74c3c";
                    statusEl.textContent = "Inspection active. Click on elements to analyze.";
                  } else {
                    inspectBtn.textContent = "Inspect UI Elements";
                    inspectBtn.style.backgroundColor = "";
                    statusEl.textContent = "Inspection stopped.";
                  }
                }
              } else if (response) {
                statusEl.textContent = `Error: ${response.error || "Unknown error"}`;  
              } else {
                statusEl.textContent = "Error: No response from content script";
              }
            });
          }
        );
      } catch (error) {
        statusEl.textContent = `Error: ${error.message}. Try refreshing the page.`;
        console.error("Exception during inspection toggle:", error);
      }
    });
  }
  
  /**
   * Capture the currently selected component
   */
  function captureComponent() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "CAPTURE_COMPONENT"}, function(response) {
        if (chrome.runtime.lastError) {
          statusEl.textContent = "Error: Could not connect to page. Try refreshing.";
          console.error("Error capturing component:", chrome.runtime.lastError);
          return;
        }
        
        console.log("Capture component response:", response);
        
        if (response && response.success) {
          statusEl.textContent = "Capturing component...";
        }
      });
    });
  }
  
  /**
   * Send captured components to Figma plugin with progressive and chunked data transmission
   * Implements html.to.design inspired approach for handling large component data
   */
  function sendComponentsToFigma() {
    if (capturedComponents.length === 0) {
      statusEl.textContent = "No components to send. Capture components first.";
      return;
    }
    
    showLoading();
    statusEl.textContent = "Preparing components for Figma...";
    
    // Enhanced debugging
    debugLog('Components to send:', capturedComponents);
    
    // Check if we have valid component data
    if (capturedComponents.some(comp => !comp || typeof comp !== 'object')) {
      handleFigmaSendError("Invalid component data detected. Please try capturing again.");
      return;
    }
    
    chrome.tabs.query({url: "*://*.figma.com/*"}, async function(figmaTabs) {
      if (figmaTabs.length === 0) {
        handleFigmaSendError("No Figma tabs found. Please open Figma in a browser tab.");
        return;
      }
      
      const figmaTab = figmaTabs[0];
      
      // First check if the Figma plugin is ready
      try {
        await checkFigmaPluginReady(figmaTab.id);
      } catch (error) {
        handleFigmaSendError("Figma plugin not detected. Please make sure the Sticker plugin is running in Figma.");
        return;
      }
      
      try {
        for (let i = 0; i < capturedComponents.length; i++) {
          const component = capturedComponents[i];
          statusEl.textContent = `Sending component ${i+1} of ${capturedComponents.length}...`;
          
          // Step 1: If we have a basic structure available, send that first for immediate feedback
          if (component.basicStructure) {
            // Extract just the basic structure data for a fast preview
            const basicData = {
              id: component.id,
              type: component.type,
              name: component.name,
              width: component.width,
              height: component.height,
              backgroundColor: component.backgroundColor || component.background || null,
              cornerRadius: component.cornerRadius || 0,
              text: component.text || null
            };
            
            // Send the basic structure first
            await sendMessageToFigma(figmaTab.id, {
              action: "SEND_TO_FIGMA_PLUGIN",
              source: "sticker-chrome-extension",
              type: "component-basic-structure",
              basicData
            });
            
            statusEl.textContent = "Basic structure sent, preparing full component...";
          }
          
          // Step 2: Prepare the full component data with Figma structure
          const figmaData = prepareFigmaData(component);
          
          // Step 3: Test serialization and determine send method
          const serializedData = JSON.stringify(figmaData);
          const dataSize = serializedData.length;
          console.log(`Component data size: ${Math.round(dataSize / 1024)} KB`);
          
          // Size thresholds based on html.to.design approach
          const CHUNK_THRESHOLD = 2000000; // ~2MB - Use chunked transmission
          const SIMPLIFY_THRESHOLD = 500000; // ~500KB - Use simplified data
          
          // Step 4: Send using appropriate method based on size
          if (dataSize > CHUNK_THRESHOLD) {
            // Use chunked transmission for very large data
            await sendChunkedDataToFigma(figmaTab.id, serializedData, component.name, dataSize);
          } else if (dataSize > SIMPLIFY_THRESHOLD) {
            // Use simplified data for medium-sized components
            const simplifiedData = simplifyFigmaData(figmaData);
            await sendMessageToFigma(figmaTab.id, {
              action: "SEND_TO_FIGMA_PLUGIN",
              source: "sticker-chrome-extension",
              type: "paste-data",
              figmaData: simplifiedData
            });
            statusEl.textContent = "Sent simplified component to Figma";
          } else {
            // Use standard transmission for small components
            await sendMessageToFigma(figmaTab.id, {
              action: "SEND_TO_FIGMA_PLUGIN",
              source: "sticker-chrome-extension",
              type: "paste-data",
              figmaData
            });
            statusEl.textContent = "Sent component to Figma";
          }
        }
        
        // All components sent successfully
        statusEl.textContent = `Successfully sent ${capturedComponents.length} component(s) to Figma!`;
        hideLoading();
        
      } catch (error) {
        handleFigmaSendError(`Error sending to Figma: ${error.message}`);
      }
    });
  }
  
  /**
   * Check if the Figma plugin is ready to receive messages
   * @param {number} tabId - Figma tab ID to check
   * @returns {Promise<boolean>} - Resolves true if ready, rejects if not
   */
  function checkFigmaPluginReady(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, {
        action: 'CHECK_FIGMA_PLUGIN_READY',
        source: 'sticker-chrome-extension'
      }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error checking Figma plugin readiness:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response && response.pluginReady) {
          console.log('Figma plugin is ready!');
          resolve(true);
        } else {
          console.error('Figma plugin not ready:', response);
          reject(new Error('Figma plugin not ready'));
        }
      });
    });
  }
  
  /**
   * Send a message to the Figma tab and return a promise
   */
  function sendMessageToFigma(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, function(response) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response && response.success) {
          resolve(response);
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response || {});
        }
      });
    });
  }
  
  /**
   * Convert a captured component to Figma-compatible data format
   */
  function prepareFigmaData(component) {
    // Create a Figma-compatible data structure
    const mainNodeId = `node-${Math.random().toString(36).substring(2, 10)}`;
    
    // Generate Figma nodes structure
    const figmaData = {
      figma: {
        version: "1.0.0",
        nodes: {
          [mainNodeId]: {
            type: component.type.toUpperCase() || "FRAME",
            name: component.name || "Component",
            width: component.width || 100,
            height: component.height || 100,
            x: 0,
            y: 0
          }
        }
      }
    };
    
    // Add styles if available
    if (component.fills && component.fills.length > 0) {
      figmaData.figma.nodes[mainNodeId].fills = component.fills;
    }
    
    if (component.strokes && component.strokes.length > 0) {
      figmaData.figma.nodes[mainNodeId].strokes = component.strokes;
    }
    
    if (component.effects && component.effects.length > 0) {
      figmaData.figma.nodes[mainNodeId].effects = component.effects;
    }
    
    // Add children if available
    if (component.children && component.children.length > 0) {
      figmaData.figma.nodes[mainNodeId].children = [];
      
      component.children.forEach((child, index) => {
        const childId = `${mainNodeId}-child-${index}`;
        figmaData.figma.nodes[mainNodeId].children.push(childId);
        
        figmaData.figma.nodes[childId] = {
          type: child.type.toUpperCase() || "RECTANGLE",
          name: child.name || `Child ${index + 1}`,
          width: child.width || 50,
          height: child.height || 50,
          x: child.x || index * 10,
          y: child.y || index * 10
        };
        
        if (child.fills && child.fills.length > 0) {
          figmaData.figma.nodes[childId].fills = child.fills;
        }
      });
    }
    
    return figmaData;
  }
  
  /**
   * Create a simplified version of the Figma data with only essential properties
   */
  function simplifyFigmaData(figmaData) {
    const simplifiedData = {
      figma: {
        version: figmaData.figma.version,
        nodes: {}
      }
    };
    
    // Simplify each node by including only essential properties
    Object.keys(figmaData.figma.nodes).forEach(nodeId => {
      const originalNode = figmaData.figma.nodes[nodeId];
      const simplifiedNode = {
        type: originalNode.type,
        name: originalNode.name,
        width: originalNode.width,
        height: originalNode.height,
        x: originalNode.x,
        y: originalNode.y
      };
      
      // Include only the first fill, stroke, and effect if they exist
      if (originalNode.fills && originalNode.fills.length > 0) {
        simplifiedNode.fills = [originalNode.fills[0]];
      }
      
      if (originalNode.strokes && originalNode.strokes.length > 0) {
        simplifiedNode.strokes = [originalNode.strokes[0]];
      }
      
      if (originalNode.effects && originalNode.effects.length > 0) {
        simplifiedNode.effects = [originalNode.effects[0]];
      }
      
      // Include children references but limit the number
      if (originalNode.children) {
        simplifiedNode.children = originalNode.children.slice(0, 10); // Limit to 10 children
      }
      
      simplifiedData.figma.nodes[nodeId] = simplifiedNode;
    });
    
    return simplifiedData;
  }
  
  /**
   * Send large data to Figma using chunked transmission
   */
  async function sendChunkedDataToFigma(tabId, serializedData, componentName, dataSize) {
    const CHUNK_SIZE = 100000; // ~100KB chunks
    const totalChunks = Math.ceil(serializedData.length / CHUNK_SIZE);
    const componentId = `component-${Date.now()}`;
    
    statusEl.textContent = `Sending large component (${Math.round(dataSize / 1024)}KB) in ${totalChunks} chunks...`;
    
    // Step 1: Send start message with metadata
    await sendMessageToFigma(tabId, {
      action: "SEND_TO_FIGMA_PLUGIN",
      source: "sticker-chrome-extension",
      type: "component-chunked-start",
      metadata: {
        id: componentId,
        name: componentName,
        totalChunks: totalChunks,
        sizeKB: Math.round(dataSize / 1024),
        timestamp: Date.now()
      }
    });
    
    // Step 2: Send each chunk sequentially
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, serializedData.length);
      const chunk = serializedData.substring(start, end);
      
      // Update progress
      const progress = Math.round((i / totalChunks) * 100);
      statusEl.textContent = `Sending chunk ${i+1}/${totalChunks} (${progress}%)...`;
      
      // Send this chunk
      await sendMessageToFigma(tabId, {
        action: "SEND_TO_FIGMA_PLUGIN",
        source: "sticker-chrome-extension",
        type: "component-chunked-data",
        componentId: componentId,
        chunkIndex: i,
        totalChunks: totalChunks,
        data: chunk
      });
      
      // Small delay to avoid overloading the message channel
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Step 3: Send completion message
    await sendMessageToFigma(tabId, {
      action: "SEND_TO_FIGMA_PLUGIN",
      source: "sticker-chrome-extension",
      type: "component-chunked-complete",
      componentId: componentId
    });
    
    statusEl.textContent = "Large component successfully sent!";
  }
  
  /**
   * Debug logging utility with timestamps
   * @param {...any} args - Arguments to log
   */
  function debugLog(...args) {
    const timestamp = new Date().toISOString().substring(11, 23);
    console.log(`[${timestamp}]`, ...args);
  }
  
  /**
   * Handle error when sending to Figma
   */
  
  /**
   * Handle Figma send error
   */
  function handleFigmaSendError(errorMessage) {
    console.error("Error sending to Figma:", errorMessage);
    statusEl.textContent = `Error: ${errorMessage}`;
    
    // Create a container for buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '10px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    
    // Try again button
    const tryAgainBtn = document.createElement('button');
    tryAgainBtn.textContent = "Try Again";
    tryAgainBtn.classList.add('action-button');
    tryAgainBtn.onclick = sendComponentsToFigma;
    buttonContainer.appendChild(tryAgainBtn);
    
    // Copy to clipboard button as fallback
    const copyBtn = document.createElement('button');
    copyBtn.textContent = "Copy to Clipboard";
    copyBtn.classList.add('action-button');
    copyBtn.onclick = function() {
      const jsonData = JSON.stringify(capturedComponents, null, 2);
      copyToClipboard(jsonData).then(() => {
        statusEl.textContent = "Data copied to clipboard! Paste in Figma plugin.";
      }).catch(err => {
        statusEl.textContent = `Clipboard error: ${err.message}. Trying file download.`;
        downloadAsFile(jsonData, "sticker-components.json");
      });
    };
    buttonContainer.appendChild(copyBtn);
    
    // Download as file button
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = "Download as File";
    downloadBtn.classList.add('action-button');
    downloadBtn.onclick = function() {
      const jsonData = JSON.stringify(capturedComponents, null, 2);
      downloadAsFile(jsonData, "sticker-components.json");
      statusEl.textContent = "Data exported as file. Import in Figma plugin.";
    };
    buttonContainer.appendChild(downloadBtn);
    
    statusEl.appendChild(document.createElement('br'));
    statusEl.appendChild(buttonContainer);
    
    hideLoading();
  }

  /**
   * Try alternative methods to send data to Figma (clipboard, file export)
   */
  function tryAlternativeSendMethods(componentData) {
    // Try to copy to clipboard
    const jsonData = JSON.stringify(componentData, null, 2);
    
    try {
      copyToClipboard(jsonData).then(() => {
        statusEl.textContent = "Data copied to clipboard! Paste in Figma plugin.";
      }).catch(error => {
        console.error("Clipboard copy failed:", error);
        downloadAsFile(jsonData, "sticker-components.json");
        statusEl.textContent = "Data exported as file. Import in Figma plugin.";
      });
    } catch (error) {
      console.error("Error with clipboard operations:", error);
      downloadAsFile(jsonData, "sticker-components.json");
      statusEl.textContent = "Data exported as file. Import in Figma plugin.";
    }
  }
  
  /**
   * Copy data to clipboard
   */
  function copyToClipboard(text) {
    return new Promise((resolve, reject) => {
      navigator.clipboard.writeText(text)
        .then(resolve)
        .catch(reject);
    });
  }
  
  /**
   * Download data as a file
   */
  function downloadAsFile(data, filename) {
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  /**
   * Extract unique colors from components
   */
  function extractUniqueColors(components) {
    const colorSet = new Set();
    
    components.forEach(component => {
      if (component.styles && component.styles.colors) {
        Object.values(component.styles.colors).forEach(color => {
          if (color) {
            colorSet.add(JSON.stringify(color));
          }
        });
      }
    });
    
    return Array.from(colorSet).map(colorStr => JSON.parse(colorStr));
  }
  
  /**
   * Extract unique typography styles from components
   */
  function extractUniqueTypography(components) {
    const typographySet = new Set();
    
    components.forEach(component => {
      if (component.styles && component.styles.typography) {
        Object.values(component.styles.typography).forEach(typo => {
          if (typo) {
            typographySet.add(JSON.stringify(typo));
          }
        });
      }
    });
    
    return Array.from(typographySet).map(typoStr => JSON.parse(typoStr));
  }
  
  /**
   * Update the list of captured components in the UI
   */
  function updateComponentsList() {
    if (capturedComponents.length > 0) {
      if (componentListEl) componentListEl.style.display = 'block';
      
      // Clear the container
      if (componentsContainerEl) {
        componentsContainerEl.innerHTML = '';
        
        // Add each component
        capturedComponents.forEach((component, index) => {
          const componentEl = document.createElement('div');
          componentEl.className = 'component-item';
          componentEl.textContent = `Component ${index + 1}: ${component.name || 'Unnamed'}`;
          componentsContainerEl.appendChild(componentEl);
        });
      }
    } else {
      if (componentListEl) componentListEl.style.display = 'none';
    }
  }
  
  /**
   * Clear the list of captured components
   */
  function clearComponentsList() {
    capturedComponents = [];
    chrome.storage.local.set({capturedComponents: []});
    updateComponentsList();
    if (sendToFigmaBtn) sendToFigmaBtn.disabled = true;
    statusEl.textContent = "Component list cleared.";
  }
  
  /**
   * Show the loading spinner
   */
  function showLoading() {
    if (loadingEl) loadingEl.style.display = 'flex';
  }
  
  /**
   * Hide the loading spinner
   */
  function hideLoading() {
    if (loadingEl) loadingEl.style.display = 'none';
  }
  
  // Variable to track inspection state
  let isInspecting = false;
  let activeFigmaTab = null;
  
  // Storage for chunked component data during reassembly
  const chunkedComponents = {};
  
  // Add variables for UI elements that may not exist
  let inspectBtn = null;
  let sendToFigmaBtn = null;
  let componentListEl = null;
  
  // Initialize UI element references
  function initializeUIElements() {
    inspectBtn = document.getElementById('inspect-elements');
    sendToFigmaBtn = document.getElementById('send-to-figma');
    componentListEl = document.getElementById('component-list');
  }
  
  // Call initialization on DOM load
  initializeUIElements();
  
  /**
   * Handle messages from content script
   * Enhanced with progressive capture and chunked data handling
   */
  function handleExtensionMessages(message, sender, sendResponse) {
    console.log('Popup received message type:', message.type || message.action);
    
    // Handle ready signal from content script
    if (message.status === "ready") {
      console.log('Content script is ready!');
      statusEl.textContent = "Ready! Click 'Inspect UI Elements' to start.";
      return true;
    }
    
    // Handle captured component
    if (message.action === 'COMPONENT_CAPTURED') {
      console.log('Component captured:', message.component);
      processComponent(message.component);
      sendResponse({ success: true });
      return true;
    }
    
    // Handle auto-processing request from content script
    if (message.action === 'AUTO_PROCESS_COMPONENT' && message.source === 'sticker-content-script') {
      console.log('Auto-processing captured component');
      
      // Show progress in status
      statusEl.textContent = "Processing component for Figma...";
      showLoading();
      if (progressContainer) progressContainer.style.display = 'block';
      
      // Find most recently captured component
      if (capturedComponents.length > 0) {
        const component = capturedComponents[capturedComponents.length - 1];
        console.log('Auto-sending component to Figma:', component);
        
        // Find Figma tabs
        chrome.tabs.query({url: "*://*.figma.com/*"}, function(tabs) {
          if (tabs.length > 0) {
            // Use the first Figma tab found
            sendComponentsToFigma(tabs[0].id);
          } else {
            statusEl.textContent = "No Figma tab found. Please open Figma.";
            hideLoading();
          }
        });
      } else {
        statusEl.textContent = "No component captured to process.";
        hideLoading();
      }
      
      return true;
    }
    
    // Handle basic structure (first stage of progressive capture)
    if (message.type === "COMPONENT_BASIC_STRUCTURE") {
      console.log('Received basic component structure');
      statusEl.textContent = "Component structure captured, retrieving styles...";
      showLoading();
      
      // We don't save this to storage yet, just acknowledge
      sendResponse({success: true});
      return true;
    }
    
    // Handle start of chunked component data
    if (message.type === "COMPONENT_CHUNKED_START") {
      console.log('Starting chunked component reception');
      const metadata = message.metadata;
      
      if (!metadata || !metadata.id) {
        console.error('Invalid chunked component metadata');
        statusEl.textContent = 'Error: Invalid chunked component metadata';
        sendResponse({success: false, error: 'Invalid metadata'});
        return true;
      }
      
      // Initialize storage for this component's chunks
      chunkedComponents[metadata.id] = {
        metadata: metadata,
        chunks: new Array(metadata.totalChunks),
        receivedChunks: 0
      };
      
      // Update UI to show progress
      statusEl.textContent = `Receiving large component in ${metadata.totalChunks} parts...`;
      showLoading();
      
      sendResponse({success: true});
      return true;
    }
    
    // Handle individual chunk of component data
    if (message.type === "COMPONENT_CHUNKED_DATA") {
      const { componentId, chunkIndex, data, totalChunks } = message;
      
      if (!componentId || !chunkedComponents[componentId]) {
        console.error('Received chunk for unknown component');
        statusEl.textContent = 'Error: Received data for unknown component';
        sendResponse({success: false, error: 'Unknown component ID'});
        return true;
      }
      
      // Store this chunk
      const componentData = chunkedComponents[componentId];
      componentData.chunks[chunkIndex] = data;
      componentData.receivedChunks++;
      
      // Update progress
      const progress = Math.round((componentData.receivedChunks / totalChunks) * 100);
      statusEl.textContent = `Receiving component: ${progress}% complete`;
      
      sendResponse({success: true});
      return true;
    }
    
    // Handle completion of chunked component
    if (message.type === "COMPONENT_CHUNKED_COMPLETE") {
      const { componentId } = message;
      
      if (!componentId || !chunkedComponents[componentId]) {
        console.error('Completion signal for unknown component');
        statusEl.textContent = 'Error: Completion signal for unknown component';
        sendResponse({success: false, error: 'Unknown component ID'});
        return true;
      }
      
      try {
        // Reassemble the component from chunks
        console.log('Reassembling chunked component...');
        statusEl.textContent = 'Reassembling component data...';
        
        const componentData = chunkedComponents[componentId];
        const fullDataString = componentData.chunks.join('');
        const fullComponent = JSON.parse(fullDataString);
        
        // Add metadata from the initial message
        fullComponent.reassembledFromChunks = true;
        fullComponent.originalChunks = componentData.metadata.totalChunks;
        
        // Process the reassembled component
        console.log('Successfully reassembled chunked component');
        processComponent(fullComponent);
        
        // Update storage
        chrome.storage.local.set({capturedComponents: capturedComponents});
        
        // Clean up chunk storage
        delete chunkedComponents[componentId];
        
        // Hide loading spinner
        hideLoading();
        
        sendResponse({success: true});
        return true;
      } catch (error) {
        console.error('Error reassembling chunked component:', error);
        statusEl.textContent = `Error reassembling component: ${error.message}`;
        hideLoading();
        sendResponse({success: false, error: error.message});
        return true;
      }
    }
    
    // Handle standard component capture
    if (message.action === "COMPONENT_CAPTURED" || message.type === "COMPONENT_CAPTURED") {
      // Process the component data
      const component = message.component || message.data;
      
      if (component) {
        try {
          // Process and validate component data
          processComponent(component);
          
          // Update storage with the processed component
          chrome.storage.local.set({capturedComponents: capturedComponents});
          
          // Hide loading spinner if it was shown
          hideLoading();
          
          // Acknowledge receipt
          sendResponse({success: true});
          return true;
        } catch (error) {
          console.error('Error processing captured component:', error);
          statusEl.textContent = `Error processing component: ${error.message}`;
          hideLoading();
          sendResponse({success: false, error: error.message});
          return true;
        }
      } else {
        console.error('Component data missing in message');
        statusEl.textContent = 'Error: Received empty component data';
        hideLoading();
        sendResponse({success: false, error: 'Empty component data'});
        return true;
      }
    }
    
    if (message.action === "INSPECTION_STATE_CHANGED" || message.type === "INSPECTION_STATE_CHANGED") {
      isInspecting = message.isInspecting;
      
      if (inspectBtn) {
        if (isInspecting) {
          inspectBtn.textContent = "Stop Inspection";
          inspectBtn.style.backgroundColor = "#e74c3c";
          statusEl.textContent = "Inspection active. Click on elements to analyze.";
        } else {
          inspectBtn.textContent = "Inspect UI Elements";
          inspectBtn.style.backgroundColor = "";
          statusEl.textContent = "Inspection stopped.";
        }
      }
      
      sendResponse({success: true});
      return true;
    }
    
    return false;
  }
  
  /**
   * Process the captured component
   */
  function processComponent(component) {
    try {
      console.log('Processing captured component data');
      
      // Validate component data
      if (!component || typeof component !== 'object') {
        throw new Error('Invalid component data received');
      }
      
      // Check if this is a simplified/truncated component
      if (component.simplified) {
        console.warn('Received simplified component data due to size limitations');
        statusEl.textContent = 'Component captured (simplified due to large size)';
      }
      
      // Add to captured components list
      capturedComponents.push(component);
      
      // Update UI
      const count = capturedComponents.length;
      updateComponentsList();
      if (sendToFigmaBtn) sendToFigmaBtn.disabled = false;
      
      statusEl.textContent = `Component captured! (${count} total)`;
    } catch (error) {
      console.error('Error processing component:', error);
      throw error; // Re-throw for the caller to handle
    }
  }
});
