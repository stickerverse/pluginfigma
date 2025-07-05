/**
 * Element Inspector for Sticker Component Analyzer
 * 
 * Provides UI for selecting and inspecting elements on a web page
 * With improved data sanitization to prevent data truncation and corruption issues
 */

// Access DOM Crawler from window object
// Note: We're not declaring a new variable, just accessing the existing one
// that was already defined in dom-crawler.js

const ElementInspector = {
  // State
  isActive: false,
  targetElement: null,
  highlightOverlay: null,
  capturePanel: null,
  capturedStates: [],
  
  /**
   * Initialize the element inspector
   */
  initialize() {
    this.createInspectorUI();
    return this;
  },
  
  /**
   * Start inspecting elements on the page
   */
  startInspection() {
    if (this.isActive) return;
    
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    
    // Create overlay and inspector UI if not already created
    if (!this.highlightOverlay) {
      this.createHighlightOverlay();
    }
    
    // Add event listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown);
    
    // Show the UI
    this.showInspectorUI();
    
    return this;
  },
  
  /**
   * Stop inspecting elements
   */
  stopInspection() {
    if (!this.isActive) return;
    
    this.isActive = false;
    document.body.style.cursor = '';
    
    // Hide overlay
    if (this.highlightOverlay) {
      this.highlightOverlay.style.display = 'none';
    }
    
    // Remove event listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown);
    
    // Hide the UI
    this.hideInspectorUI();
    
    return this;
  },
  
  /**
   * Create the highlight overlay element
   */
  createHighlightOverlay() {
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.id = 'sticker-highlight-overlay';
    this.highlightOverlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #4e9fff;
      background-color: rgba(78, 159, 255, 0.1);
      border-radius: 3px;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5);
      z-index: 99999;
      display: none;
    `;
    document.body.appendChild(this.highlightOverlay);
    
    return this;
  },
  
  /**
   * Create the inspector UI panel
   */
  createInspectorUI() {
    // Create capture panel
    this.capturePanel = document.createElement('div');
    this.capturePanel.id = 'sticker-capture-panel';
    this.capturePanel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 300px;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
      z-index: 999999;
      display: none;
      overflow: hidden;
    `;
    
    // Create panel header
    const header = document.createElement('div');
    header.style.cssText = `
      background-color: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
      padding: 10px 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Sticker Component Capture';
    title.style.cssText = `
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: #333;
    `;
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #666;
    `;
    closeButton.onclick = () => this.stopInspection();
    
    header.appendChild(title);
    header.appendChild(closeButton);
    
    // Create panel content
    const content = document.createElement('div');
    content.style.cssText = `
      padding: 15px;
    `;
    
    // Element info section
    const infoSection = document.createElement('div');
    infoSection.id = 'sticker-element-info';
    infoSection.style.cssText = `
      margin-bottom: 15px;
      padding: 10px;
      background-color: #f9f9f9;
      border-radius: 4px;
      font-size: 12px;
      color: #333;
    `;
    infoSection.textContent = 'Hover over elements to inspect';
    
    // Capture actions
    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    
    // Capture single button
    const captureSingleButton = document.createElement('button');
    captureSingleButton.textContent = 'Capture Element';
    captureSingleButton.style.cssText = `
      padding: 8px 12px;
      background-color: #4e9fff;
      border: none;
      border-radius: 4px;
      color: white;
      font-weight: 500;
      font-size: 13px;
      cursor: pointer;
      opacity: 0.7;
      pointer-events: none;
    `;
    captureSingleButton.id = 'sticker-capture-single';
    captureSingleButton.onclick = () => this.captureElement();
    
    // Capture with variants button
    const captureVariantsButton = document.createElement('button');
    captureVariantsButton.textContent = 'Capture with Variants';
    captureVariantsButton.style.cssText = `
      padding: 8px 12px;
      background-color: #6c5ce7;
      border: none;
      border-radius: 4px;
      color: white;
      font-weight: 500;
      font-size: 13px;
      cursor: pointer;
      opacity: 0.7;
      pointer-events: none;
    `;
    captureVariantsButton.id = 'sticker-capture-variants';
    captureVariantsButton.onclick = () => this.captureElementWithVariants();
    
    // Create component button
    const createComponentButton = document.createElement('button');
    createComponentButton.textContent = 'Create Component in Figma';
    createComponentButton.style.cssText = `
      padding: 10px 12px;
      margin-top: 5px;
      background-color: #0fa958;
      border: none;
      border-radius: 4px;
      color: white;
      font-weight: 500;
      font-size: 13px;
      cursor: pointer;
      display: none;
    `;
    createComponentButton.id = 'sticker-create-component';
    createComponentButton.onclick = () => this.sendCapturedStatesToFigma();
    
    // Captured states list
    const capturedStatesContainer = document.createElement('div');
    capturedStatesContainer.id = 'sticker-captured-states';
    capturedStatesContainer.style.cssText = `
      margin-top: 15px;
      max-height: 150px;
      overflow-y: auto;
      border-top: 1px solid #e0e0e0;
      padding-top: 10px;
      display: none;
    `;
    
    // Instructions
    const instructions = document.createElement('p');
    instructions.textContent = 'Click on an element to select it, then capture it as a component';
    instructions.style.cssText = `
      margin: 0 0 15px 0;
      font-size: 12px;
      color: #666;
      line-height: 1.4;
    `;
    
    // Assemble UI
    actions.appendChild(instructions);
    actions.appendChild(captureSingleButton);
    actions.appendChild(captureVariantsButton);
    actions.appendChild(createComponentButton);
    
    content.appendChild(infoSection);
    content.appendChild(actions);
    content.appendChild(capturedStatesContainer);
    
    this.capturePanel.appendChild(header);
    this.capturePanel.appendChild(content);
    
    // Add to document
    document.body.appendChild(this.capturePanel);
    
    return this;
  },
  
  /**
   * Show the inspector UI
   */
  showInspectorUI() {
    if (this.capturePanel) {
      this.capturePanel.style.display = 'block';
    }
    return this;
  },
  
  /**
   * Create or update the capture progress indicator
   * @private
   */
  _showCaptureProgress(message) {
    // Remove any existing progress indicator
    const existingIndicator = document.getElementById('sticker-capture-progress');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    // Create new progress indicator
    const progressIndicator = document.createElement('div');
    progressIndicator.id = 'sticker-capture-progress';
    progressIndicator.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 999999;
      display: flex;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    
    // Add spinner
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: sticker-spinner 0.8s linear infinite;
      margin-right: 12px;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes sticker-spinner {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    // Add message
    const messageEl = document.createElement('span');
    messageEl.textContent = message;
    
    progressIndicator.appendChild(spinner);
    progressIndicator.appendChild(messageEl);
    document.body.appendChild(progressIndicator);
    
    return progressIndicator;
  },
  
  /**
   * Update the progress indicator message
   * @private
   */
  _updateCaptureProgress(message) {
    const progressIndicator = document.getElementById('sticker-capture-progress');
    if (progressIndicator) {
      const messageEl = progressIndicator.querySelector('span');
      if (messageEl) {
        messageEl.textContent = message;
      }
    } else {
      this._showCaptureProgress(message);
    }
  },
  
  /**
   * Hide the capture progress indicator
   * @private
   */
  _hideCaptureProgress() {
    const progressIndicator = document.getElementById('sticker-capture-progress');
    if (progressIndicator) {
      progressIndicator.remove();
    }
  },
  
  /**
   * Capture basic structure of an element, similar to html.to.design first pass
   * @private
   */
  _captureBasicStructure(element) {
    if (!element) return null;
    
    try {
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      
      // Basic component data with only essential properties
      const basicStructure = {
        id: `basic-${Math.random().toString(36).substring(2, 10)}`,
        type: element.tagName.toLowerCase(),
        name: this._generateElementName(element),
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        children: [],
        basicStructure: true
      };
      
      // Add only the most essential styles that don't require complex processing
      if (computedStyle.backgroundColor && computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        basicStructure.backgroundColor = computedStyle.backgroundColor;
      }
      
      if (computedStyle.borderRadius && parseFloat(computedStyle.borderRadius) > 0) {
        basicStructure.cornerRadius = parseFloat(computedStyle.borderRadius);
      }
      
      // For text elements, grab just the content
      if (this._isTextElement(element)) {
        const text = element.textContent.trim();
        if (text) {
          basicStructure.text = text.substring(0, 100); // Limit text length
        }
      }
      
      return basicStructure;
    } catch (error) {
      console.error('Error capturing basic structure:', error);
      return null;
    }
  },

  /**
   * Check if an element is a text element
   * @private
   */
  _isTextElement(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    const textTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'label', 'button', 'li'];
    
    if (textTags.includes(tagName)) return true;
    
    // Also check if it has direct text content
    const childNodes = element.childNodes;
    for (let i = 0; i < childNodes.length; i++) {
      if (childNodes[i].nodeType === Node.TEXT_NODE && childNodes[i].textContent.trim().length > 0) {
        return true;
      }
    }
    
    return false;
  },

  /**
   * Generate element name safely - mimics html.to.design's smart naming
   * @private
   */
  _generateElementName(element) {
    if (!element) return 'Unknown Element';
    
    const tagName = element.tagName.toLowerCase();
    
    // Use HTML semantics to create meaningful names
    const semanticNames = {
      'button': 'Button',
      'input': element.type ? `${element.type.charAt(0).toUpperCase() + element.type.slice(1)} Input` : 'Input Field',
      'a': 'Link',
      'img': 'Image',
      'h1': 'Heading 1',
      'h2': 'Heading 2',
      'h3': 'Heading 3',
      'p': 'Paragraph',
      'ul': 'List',
      'ol': 'Ordered List',
      'nav': 'Navigation',
      'header': 'Header',
      'footer': 'Footer',
      'section': 'Section',
      'article': 'Article',
      'form': 'Form'
    };
    
    // Start with semantic name if available
    let name = semanticNames[tagName] || tagName.charAt(0).toUpperCase() + tagName.slice(1);
    
    // Add identifier from data attributes or ID
    const dataId = element.getAttribute('data-testid') || 
                  element.getAttribute('data-id') || 
                  element.getAttribute('id');
    
    if (dataId && dataId.length < 30) {
      name += ' ' + dataId;
    }
    
    // For text elements, add a hint of their content
    if (this._isTextElement(element)) {
      const text = element.textContent.trim();
      if (text && text.length > 0) {
        const shortText = text.length > 20 ? text.substring(0, 17) + '...' : text;
        name += ` "${shortText}"`;
      }
    }

    return name;
},

/**
 * Check if an element is a text element
 * @private
 */
_isTextElement(element) {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  const textTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'label', 'button', 'li'];

  if (textTags.includes(tagName)) return true;

  // Also check if it has direct text content
  const childNodes = element.childNodes;
  for (let i = 0; i < childNodes.length; i++) {
    if (childNodes[i].nodeType === Node.TEXT_NODE && childNodes[i].textContent.trim().length > 0) {
      return true;
    }
  }

  return false;
},

/**
 * Generate element name safely - mimics html.to.design's smart naming
 * @private
 */
_generateElementName(element) {
  if (!element) return 'Unknown Element';

  const tagName = element.tagName.toLowerCase();

  // Use HTML semantics to create meaningful names
  const semanticNames = {
    'button': 'Button',
    'input': element.type ? `${element.type.charAt(0).toUpperCase() + element.type.slice(1)} Input` : 'Input Field',
    'a': 'Link',
    'img': 'Image',
    'h1': 'Heading 1',
    'h2': 'Heading 2',
    'h3': 'Heading 3',
    'p': 'Paragraph',
    'ul': 'List',
    'ol': 'Ordered List',
    'nav': 'Navigation',
    'header': 'Header',
    'footer': 'Footer',
    'section': 'Section',
    'article': 'Article',
    'form': 'Form'
  };

  // Start with semantic name if available
  let name = semanticNames[tagName] || tagName.charAt(0).toUpperCase() + tagName.slice(1);

  // Add identifier from data attributes or ID
  const dataId = element.getAttribute('data-testid') || 
                element.getAttribute('data-id') || 
                element.getAttribute('id');

  if (dataId && dataId.length < 30) {
    name += ' ' + dataId;
  }

  // For text elements, add a hint of their content
  if (this._isTextElement(element)) {
    const text = element.textContent.trim();
    if (text && text.length > 0) {
      const shortText = text.length > 20 ? text.substring(0, 17) + '...' : text;
      name += ` "${shortText}"`;
    }
  }

  return name;
},

/**
 * Hide the inspector UI
 */
hideInspectorUI() {
  if (this.capturePanel) {
    this.capturePanel.style.display = 'none';
  }
  return this;
},

/**
 * Handle mouse move events during inspection
 */
handleMouseMove(event) {
  if (!ElementInspector.isActive) return;
  
  // Ignore events from our own UI
  if (event.target.closest('#sticker-capture-panel')) {
    return;
  }
  
  // Get element under cursor
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (!element) return;
  
  // Update highlight overlay
  ElementInspector.highlightElement(element);
  
  // Update info panel
  ElementInspector.updateElementInfo(element);
},

/**
 * Handle click events during inspection
 */
handleClick(event) {
  if (!ElementInspector.isActive) return;
  
  // Ignore clicks on our own UI
  if (event.target.closest('#sticker-capture-panel')) {
    return;
  }
  
  // Prevent the default action
  event.preventDefault();
  event.stopPropagation();
  
  // Get element under cursor
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (!element) return;
  
  // Set as target element
  ElementInspector.selectElement(element);
},

/**
 * Handle keyboard events during inspection
 */
handleKeyDown(event) {
  if (!ElementInspector.isActive) return;
  
  // Escape key cancels inspection
  if (event.key === 'Escape') {
    ElementInspector.stopInspection();
  }
},

/**
 * Highlight an element on the page
 */
highlightElement(element) {
  if (!this.highlightOverlay || !element) return;
  
  // Get element dimensions
  const rect = element.getBoundingClientRect();
  
  // Position overlay
  this.highlightOverlay.style.display = 'block';
  this.highlightOverlay.style.left = `${rect.left}px`;
  this.highlightOverlay.style.top = `${rect.top}px`;
  this.highlightOverlay.style.width = `${rect.width}px`;
  this.highlightOverlay.style.height = `${rect.height}px`;
},

/**
 * Update element info in the UI panel
 */
updateElementInfo(element) {
  if (!element) return;
  
  const infoElement = document.getElementById('sticker-element-info');
  if (!infoElement) return;
  
  // Get element information
  const tagName = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = element.className && typeof element.className === 'string' ? 
                 `.${element.className.trim().replace(/\s+/g, '.')}` : '';
  
  // Get element dimensions
  const rect = element.getBoundingClientRect();
  const dimensions = `${Math.round(rect.width)} × ${Math.round(rect.height)}px`;
  
  // Display information
  infoElement.innerHTML = `
    <strong>Element:</strong> ${tagName}${id}${classes}<br>
    <strong>Size:</strong> ${dimensions}
  `;
},

/**
 * Select an element for capture
 */
selectElement(element) {
  if (!element) return;
  
  // Update the target element
  this.targetElement = element;
  
  // Highlight the selected element
  this.highlightElement(element);
  
  // Enable capture buttons
  const captureSingleButton = document.getElementById('sticker-capture-single');
  const captureVariantsButton = document.getElementById('sticker-capture-variants');
  
  if (captureSingleButton) {
    captureSingleButton.style.opacity = '1';
    captureSingleButton.style.pointerEvents = 'auto';
  }
  
  if (captureVariantsButton) {
    captureVariantsButton.style.opacity = '1';
    captureVariantsButton.style.pointerEvents = 'auto';
  }
  
  // Update info panel
  this.updateElementInfo(element);
  
  return this;
},

/**
 * Debug logging utility with timestamps
 * @private
 */
_debugLog(...args) {
  const timestamp = new Date().toISOString().substring(11, 23);
  console.log(`[${timestamp}][element-inspector]`, ...args);
},

/**
 * Capture the selected element with enhanced data sanitization
 * Uses a progressive capture approach similar to html.to.design
 */
async captureElement(element) {
  this._debugLog('Starting element capture');
  // Use the provided element or fall back to the previously selected targetElement
  const targetEl = element || this.targetElement;
  
  if (!targetEl) {
    this._debugLog('ERROR: No element selected for capture');
    document.dispatchEvent(new CustomEvent('STICKER_SEND_TO_EXTENSION', {
      detail: {
        type: 'COMPONENT_CAPTURE_ERROR',
        error: 'No element selected for capture'
      }
    }));
    return;
  }
  
  // Set the targetElement to ensure other functions have access to it
  this.targetElement = targetEl;
  try {
    // Show capture in progress indicator
    this._showCaptureProgress('Analyzing component structure...');
    
    // Step 1: Capture basic structure and positioning first
    console.log('Step 1: Capturing basic structure and position...');
    const basicStructure = this._captureBasicStructure(this.targetElement);
    
    // Step 2: Analyze element with built-in sanitization in DOM Crawler
    console.log('Step 2: Analyzing full component with sanitization...');
    this._updateCaptureProgress('Analyzing styles and properties...');
    const elementData = window.DOMCrawler.analyzeElement(this.targetElement);
    
    // Send the basic structure immediately to provide instant feedback
    if (basicStructure) {
      this._updateCaptureProgress('Initial capture complete, sending basic structure...');
      console.log('Sending initial basic structure data');
      
      // Send basic structure to extension/plugin
      document.dispatchEvent(new CustomEvent('STICKER_SEND_TO_EXTENSION', {
        detail: {
          type: 'COMPONENT_BASIC_STRUCTURE',
          component: basicStructure
        }
      }));
    }
    
    if (elementData) {
      // Add to captured states
      this.capturedStates = [elementData];
        
        // Update UI
        this.updateCapturedStatesList();
        this.showCreateComponentButton();
        
        console.log('Element analyzed successfully, preparing to send data...');
        this._updateCaptureProgress('Processing captured data...');
        
        try {
          // Validate that the data can be serialized before sending
          const serializedData = JSON.stringify(elementData);
          const dataSizeKB = Math.round(serializedData.length / 1024);
          console.log(`Component data size: ${dataSizeKB} KB`);
          
          // Implement html.to.design style progressive transmission
          if (serializedData.length > 2000000) { // ~2MB - extremely large
            console.warn('Component data extremely large, using chunked approach');
            this._updateCaptureProgress('Large component detected, optimizing data...');
            
            // First send metadata about the component
            const componentMetadata = {
              id: elementData.id?.substring(0, 50) || `component-${Date.now()}`,
              type: 'FRAME',
              name: elementData.name?.substring(0, 50) || 'Large Component',
              x: elementData.x || 0,
              y: elementData.y || 0,
              width: elementData.width || 100,
              height: elementData.height || 100,
              isChunked: true,
              totalChunks: 0, // Will be calculated below
              totalSize: serializedData.length,
              sizeKB: dataSizeKB
            };
            
            // Extract critical properties to include in the metadata
            if (elementData.fills && Array.isArray(elementData.fills) && elementData.fills.length > 0) {
              componentMetadata.mainFill = elementData.fills[0];
            }
            
            if (elementData.cornerRadius) {
              componentMetadata.cornerRadius = elementData.cornerRadius;
            }
            
            // Calculate number of chunks needed (100KB per chunk is safe)
            const CHUNK_SIZE = 100000; // 100KB chunks
            const totalChunks = Math.ceil(serializedData.length / CHUNK_SIZE);
            componentMetadata.totalChunks = totalChunks;
            
            this._updateCaptureProgress(`Sending component in ${totalChunks} parts...`);
            
            // First send the metadata
            document.dispatchEvent(new CustomEvent('STICKER_SEND_TO_EXTENSION', {
              detail: {
                type: 'COMPONENT_CHUNKED_START',
                metadata: componentMetadata
              }
            }));
            
            // Then send each chunk with a small delay to avoid overwhelming the message bus
            for (let i = 0; i < totalChunks; i++) {
              const start = i * CHUNK_SIZE;
              const end = Math.min((i + 1) * CHUNK_SIZE, serializedData.length);
              const chunk = serializedData.substring(start, end);
              
              // Use setTimeout to avoid blocking the main thread
              setTimeout(() => {
                this._updateCaptureProgress(`Sending part ${i+1} of ${totalChunks}...`);
                document.dispatchEvent(new CustomEvent('STICKER_SEND_TO_EXTENSION', {
                  detail: {
                    type: 'COMPONENT_CHUNKED_DATA',
                    chunkIndex: i,
                    totalChunks: totalChunks,
                    componentId: componentMetadata.id,
                    data: chunk
                  }
                }));
                
                // Send completion notice after last chunk
                if (i === totalChunks - 1) {
                  setTimeout(() => {
                    this._updateCaptureProgress('Finalizing component data...');
                    document.dispatchEvent(new CustomEvent('STICKER_SEND_TO_EXTENSION', {
                      detail: {
                        type: 'COMPONENT_CHUNKED_COMPLETE',
                        componentId: componentMetadata.id
                      }
                    }));
                    
                    this._hideCaptureProgress();
                    console.log('Chunked component data transmission complete');
                  }, 200);
                }
              }, i * 150); // Small delay between chunks
            }
          }
          else if (serializedData.length > 500000) { // ~500KB - large but can still be sent in one go
            console.warn('Component data large, sending simplified version');
            this._updateCaptureProgress('Optimizing component data...');
            
            // Create a simplified version with reduced property set but maintaining essential styles
            const simplifiedData = {
              id: elementData.id?.substring(0, 50) || `component-${Date.now()}`,
              type: elementData.type || 'FRAME',
              name: elementData.name?.substring(0, 50) || 'Component',
              x: elementData.x || 0,
              y: elementData.y || 0,
              width: elementData.width || 100,
              height: elementData.height || 100,
              simplified: true,
              // Extract limited but essential properties
              fills: elementData.fills?.slice(0, 5) || [],
              strokes: elementData.strokes?.slice(0, 2) || [],
              effects: elementData.effects?.slice(0, 3) || [],
              cornerRadius: elementData.cornerRadius,
              children: elementData.children?.slice(0, 10).map(child => ({
                id: child.id?.substring(0, 50),
                type: child.type,
                name: child.name?.substring(0, 50),
                x: child.x || 0,
                y: child.y || 0,
                width: child.width || 10,
                height: child.height || 10,
              })),
              sizeKB: dataSizeKB,
              message: `Component was large (${dataSizeKB}KB) and was optimized for transmission`
            };
            
            // Extract typography if present
            if (elementData.typography) {
              simplifiedData.typography = {
                fontFamily: elementData.typography.fontFamily?.substring(0, 50),
                fontSize: elementData.typography.fontSize,
                fontWeight: elementData.typography.fontWeight,
                text: elementData.typography.text?.substring(0, 100)
              };
            }
            
            // Send simplified component
            this._updateCaptureProgress('Sending optimized component...');
            document.dispatchEvent(new CustomEvent('STICKER_SEND_TO_EXTENSION', {
              detail: {
                type: 'COMPONENT_CAPTURED',
                component: simplifiedData
              }
            }));
            this._hideCaptureProgress();
          } else {
            // Data is within acceptable size limits, send full component
            this._updateCaptureProgress('Sending component to Figma...');
            document.dispatchEvent(new CustomEvent('STICKER_SEND_TO_EXTENSION', {
              detail: {
                type: 'COMPONENT_CAPTURED',
                component: elementData
              }
            }));
            this._hideCaptureProgress();
          }
          
          console.log('Element captured and sent to extension successfully');
        } catch (jsonError) {
          console.error('Failed to serialize component data:', jsonError);
          this._updateCaptureProgress('Error: Failed to process component');
          
          // Send error notification with fallback data
          document.dispatchEvent(new CustomEvent('STICKER_SEND_TO_EXTENSION', {
            detail: {
              type: 'COMPONENT_CAPTURE_ERROR',
              error: jsonError.message,
              fallbackComponent: {
                name: 'Error Capturing Component',
                type: 'FRAME',
                width: 100,
                height: 100
              }
            }
          }));
          
          setTimeout(() => this._hideCaptureProgress(), 2000);
        }
      }
    } catch (error) {
      console.error('Error capturing element:', error);
      
      // Notify the extension of the error
      document.dispatchEvent(new CustomEvent('STICKER_SEND_TO_EXTENSION', {
        detail: {
          type: 'COMPONENT_CAPTURE_ERROR',
          error: error.message
        }
      }));
    }
  },
  
  /**
   * Capture the element with its different states (hover, active, etc)
   */
  async captureElementWithVariants() {
    if (!this.targetElement) return;
    
    try {
      // Analyze element with variants
      const variantStates = await window.DOMCrawler.analyzeElementWithVariants(this.targetElement);
      
      if (variantStates && variantStates.length > 0) {
        // Add to captured states
        this.capturedStates = variantStates;
        
        // Update UI
        this.updateCapturedStatesList();
        this.showCreateComponentButton();
        
        // Send message to extension
        if (chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            action: 'ELEMENT_VARIANTS_CAPTURED',
            data: variantStates
          });
        }
      }
    } catch (error) {
      console.error('Error capturing element variants:', error);
    }
  },
  
  /**
   * Update the list of captured states in the UI
   */
  updateCapturedStatesList() {
    const container = document.getElementById('sticker-captured-states');
    if (!container) return;
    
    // Show the container
    container.style.display = 'block';
    
    // Clear existing content
    container.innerHTML = '';
    
    // Add title
    const title = document.createElement('h4');
    title.textContent = 'Captured States';
    title.style.cssText = `
      margin: 0 0 8px 0;
      font-size: 13px;
      font-weight: 500;
    `;
    container.appendChild(title);
    
    // Create list
    const list = document.createElement('ul');
    list.style.cssText = `
      margin: 0;
      padding: 0;
      list-style: none;
    `;
    
    // Add each state
    this.capturedStates.forEach((state, index) => {
      const item = document.createElement('li');
      item.style.cssText = `
        padding: 6px 8px;
        border-radius: 4px;
        margin-bottom: 4px;
        background-color: #f0f7ff;
        font-size: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      
      const stateName = state.properties?.state || `State ${index + 1}`;
      item.textContent = `${state.name} - ${stateName}`;
      
      // Add remove button
      const removeButton = document.createElement('button');
      removeButton.textContent = '×';
      removeButton.style.cssText = `
        background: none;
        border: none;
        font-size: 14px;
        cursor: pointer;
        color: #666;
      `;
      removeButton.onclick = () => {
        this.capturedStates.splice(index, 1);
        this.updateCapturedStatesList();
        
        // Hide create button if no states left
        if (this.capturedStates.length === 0) {
          this.hideCreateComponentButton();
        }
      };
      
      item.appendChild(removeButton);
      list.appendChild(item);
    });
    
    container.appendChild(list);
  },
  
  /**
   * Show the Create Component button
   */
  showCreateComponentButton() {
    const button = document.getElementById('sticker-create-component');
    if (button) {
      button.style.display = 'block';
    }
  },
  
  /**
   * Hide the Create Component button
   */
  hideCreateComponentButton() {
    const button = document.getElementById('sticker-create-component');
    if (button) {
      button.style.display = 'none';
    }
  },
  
  /**
   * Send captured states to Figma plugin
   */
  sendCapturedStatesToFigma() {
    if (this.capturedStates.length === 0) {
      console.warn('No states to send to Figma');
      return;
    }
    
    try {
      console.log('Preparing component data for Figma...');
      
      // Extract only necessary data
      const sanitizedStates = this.capturedStates.map(state => {
        // Create a clean copy with only essential properties
        return {
          id: state.id,
          type: state.type,
          name: state.name,
          width: state.width,
          height: state.height,
          fills: state.fills,
          strokes: state.strokes,
          properties: state.properties,
          children: state.children || []
        };
      });
      
      const colors = this._extractColorsFromStates(this.capturedStates);
      const typography = this._extractTypographyFromStates(this.capturedStates);
      
      const componentData = {
        components: sanitizedStates,
        colors: colors,
        typography: typography
      };
      
      // Validate that the data can be serialized
      const serializedData = JSON.stringify(componentData);
      console.log(`Component data size: ${Math.round(serializedData.length / 1024)} KB`);
      
      if (serializedData.length > 500000) { // ~500KB limit
        console.warn('Component data too large, simplifying before sending');
        const simplifiedData = {
          components: sanitizedStates.map(state => ({
            id: state.id,
            type: state.type,
            name: state.name,
            width: state.width,
            height: state.height
          })),
          colors: colors.slice(0, 10), // Limit to 10 colors
          typography: typography.slice(0, 5), // Limit to 5 typography styles
          simplified: true
        };
        
        // Send simplified data
        document.dispatchEvent(new CustomEvent('STICKER_SEND_TO_EXTENSION', {
          detail: {
            type: 'COMPONENT_DATA',
            components: simplifiedData
          }
        }));
      } else {
        // Send full component data
        document.dispatchEvent(new CustomEvent('STICKER_SEND_TO_EXTENSION', {
          detail: {
            type: 'COMPONENT_DATA',
            components: componentData
          }
        }));
      }

      console.log('Sent component data to extension successfully');
    } catch (error) {
      console.error('Error preparing component data:', error);
      
      // Send error notification
      document.dispatchEvent(new CustomEvent('STICKER_SEND_TO_EXTENSION', {
        detail: {
          type: 'COMPONENT_DATA_ERROR',
          error: error.message
        }
      }));
    } finally {
      // Hide UI
      this.stopInspection();
      this.hideInspectorUI();
    }
  },
  
  /**
   * Extract color information from component states
   * @private
   */
  _extractColorsFromStates(states) {
    const colors = new Map();
    
    // Extract colors from fills
    states.forEach(state => {
      if (state.fills) {
        state.fills.forEach(fill => {
          if (fill.type === 'SOLID' && fill.color) {
            const colorKey = `${fill.color.r}-${fill.color.g}-${fill.color.b}-${fill.opacity || 1}`;
            if (!colors.has(colorKey)) {
              colors.set(colorKey, {
                name: `Color ${colors.size + 1}`,
                color: fill.color,
                opacity: fill.opacity || 1
              });
            }
          }
        });
      }
    });
    
    return Array.from(colors.values());
  },
  
  /**
   * Extract typography information from component states with sanitization
   * @private
   */
  _extractTypographyFromStates(states) {
    const typography = [];
    const seenStyles = new Set(); // To avoid duplicates
    
    try {
      // Process each state
      states.forEach(state => {
        if (!state.typography) return;
        
        // Create a sanitized copy of the typography data
        const sanitizedTypography = {};
        
        // Only include essential typography properties
        if (state.typography.fontFamily) {
          sanitizedTypography.fontFamily = state.typography.fontFamily.substring(0, 100); // Limit length
        }
        
        if (state.typography.fontSize) {
          sanitizedTypography.fontSize = parseFloat(state.typography.fontSize) || 12;
        }
        
        if (state.typography.fontWeight) {
          sanitizedTypography.fontWeight = state.typography.fontWeight;
        }
        
        if (state.typography.lineHeight) {
          sanitizedTypography.lineHeight = parseFloat(state.typography.lineHeight) || 1.2;
        }
        
        if (state.typography.letterSpacing) {
          sanitizedTypography.letterSpacing = parseFloat(state.typography.letterSpacing) || 0;
        }
        
        // Limit text content to avoid huge strings
        if (state.typography.text) {
          sanitizedTypography.text = state.typography.text.substring(0, 500); // Limit to 500 chars
        }
        
        // Generate a unique key for this typography style to avoid duplicates
        const styleKey = `${sanitizedTypography.fontFamily}-${sanitizedTypography.fontSize}-${sanitizedTypography.fontWeight}`;
        
        if (!seenStyles.has(styleKey)) {
          seenStyles.add(styleKey);
          typography.push(sanitizedTypography);
        }
        
        // Limit to maximum 10 typography styles
        if (typography.length >= 10) {
          return;
        }
      });
    } catch (error) {
      console.error('Error extracting typography:', error);
      // Return empty array on error rather than crashing
    }
    
    return typography;
  }
};

// Bind methods to the object
ElementInspector.handleMouseMove = ElementInspector.handleMouseMove.bind(ElementInspector);
ElementInspector.handleClick = ElementInspector.handleClick.bind(ElementInspector);
ElementInspector.handleKeyDown = ElementInspector.handleKeyDown.bind(ElementInspector);

// Set up event listeners for messages from content script
document.addEventListener('STICKER_INIT_INSPECTOR', function() {
  console.log('Element Inspector: Initialized');
  ElementInspector.initialize();
});

document.addEventListener('STICKER_START_INSPECTION', function() {
  console.log('Element Inspector: Starting inspection');
  ElementInspector.startInspection();
});

// Listen for inspection toggle command from content script
document.addEventListener('STICKER_TOGGLE_INSPECTION', function() {
  console.log('Element Inspector: Toggle inspection received');
  ElementInspector.isInspecting = !ElementInspector.isInspecting;
  if (ElementInspector.isInspecting) {
    ElementInspector.startInspection();
  } else {
    ElementInspector.stopInspection();
  }
});

// Listen for streamlined capture start command
document.addEventListener('STICKER_START_STREAMLINED_CAPTURE', function(event) {
  const timestamp = new Date().toISOString().substring(11, 23);
  console.log(`[${timestamp}][element-inspector] Starting streamlined capture mode`);
  ElementInspector.startInspection();
});

// Listen for capture component command
document.addEventListener('STICKER_CAPTURE_COMPONENT', function(event) {
  const timestamp = new Date().toISOString().substring(11, 23);
  console.log(`[${timestamp}][element-inspector] Capture component received`, event.detail);
  
  // If we have a specific target element from the content script, use it
  if (event.detail && event.detail.targetElement) {
    ElementInspector.selectedElement = event.detail.targetElement;
  }
  
  if (ElementInspector.selectedElement) {
    ElementInspector.captureElement(ElementInspector.selectedElement);
  } else {
    console.error('No element selected for capture');
  }
});

document.addEventListener('STICKER_STOP_INSPECTION', function() {
  console.log('Element Inspector: Stopping inspection');
  ElementInspector.stopInspection();
});

document.addEventListener('STICKER_CAPTURE_COMPONENT', function() {
  console.log('Element Inspector: Capturing component');
  if (ElementInspector.targetElement) {
    ElementInspector.captureElement();
  } else {
    console.warn('Element Inspector: No element selected for capture');
    // Notify the extension that no element is selected
    document.dispatchEvent(new CustomEvent('STICKER_SEND_TO_EXTENSION', {
      detail: {
        action: 'CAPTURE_FAILED',
        message: 'No element selected'
      }
    }));
  }
});

// Make ElementInspector available globally
window.ElementInspector = ElementInspector;

// Export the module
if (typeof module !== 'undefined') {
  module.exports = ElementInspector;
} else {
  window.ElementInspector = ElementInspector;
}

// End of Element Inspector module
console.log('Element Inspector loaded successfully');
