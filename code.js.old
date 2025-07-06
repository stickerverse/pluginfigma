// Visionary UI - Figma Plugin
// Transforms static UI images into fully editable, production-ready Figma components

// Initialize plugin with proper feedback system
figma.showUI(__html__, { width: 450, height: 550, title: 'Visionary UI - Image to Component' });

// Storage for chunked component data during reassembly
const chunkedComponents = {};

// Provide immediate user feedback
figma.notify('🎯 Visionary UI loaded successfully!', { timeout: 3000 });

// Let the Chrome extension know that the Figma plugin is ready
figma.ui.postMessage({
  type: 'plugin-ready',
  source: 'visionary-ui-figma-plugin',
  message: 'Visionary UI plugin is ready to transform images'
});

// Announce plugin presence for Chrome extension detection
setInterval(() => {
  figma.ui.postMessage({
    type: 'plugin-heartbeat',
    source: 'visionary-ui-figma-plugin', 
    timestamp: Date.now()
  });
}, 3000); // Every 3 seconds

/**
 * Enhanced debugging log with timestamps and contexts
 */
function debugLog(context, ...args) {
  const timestamp = new Date().toISOString().substring(11, 23);
  console.log(`[${timestamp}][${context}]`, ...args);
}

// Listen for messages from the UI
figma.ui.onmessage = async (msg) => {
  debugLog('figma-plugin', 'Received message:', msg.type, msg);
  
  // ===== CORE VISIONARY UI FUNCTIONALITY =====
  
  // Handle image analysis completion (main feature)
  if (msg.type === 'IMAGE_ANALYSIS_COMPLETE') {
    try {
      figma.notify('🔄 Creating components from image analysis...', { timeout: 2000 });
      
      const imageData = msg.data;
      const parentFrame = await processImageAnalysisResults(imageData);
      
      // Select and focus the created components
      figma.currentPage.selection = [parentFrame];
      figma.viewport.scrollAndZoomIntoView([parentFrame]);
      
      figma.notify('✅ Components created successfully!', { timeout: 4000 });
      
      // Notify UI that creation is complete
      figma.ui.postMessage({ 
        type: 'CREATION_COMPLETE',
        success: true
      });
      
    } catch (error) {
      console.error('Error in image analysis handler:', error);
      figma.notify(`❌ Error creating components: ${error.message}`, { error: true });
      
      figma.ui.postMessage({
        type: 'CREATION_ERROR',
        message: `Error creating components: ${error.message}`
      });
    }
  }
  
  // Handle external data from Chrome extension
  else if (msg.type === 'EXTERNAL_DATA_RECEIVED') {
    try {
      figma.notify('📥 Processing component data from Chrome extension...', { timeout: 2000 });
      
      const componentData = msg.data;
      
      // Convert Chrome extension data to our internal format
      const imageAnalysisData = convertExternalData(componentData);
      
      // Process the converted data
      const parentFrame = await processImageAnalysisResults(imageAnalysisData);
      
      // Select and focus the created components
      figma.currentPage.selection = [parentFrame];
      figma.viewport.scrollAndZoomIntoView([parentFrame]);
      
      figma.notify('✅ Chrome extension components created successfully!', { timeout: 4000 });
      
    } catch (error) {
      console.error('Error processing external data:', error);
      figma.notify(`❌ Error processing Chrome extension data: ${error.message}`, { error: true });
    }
  }
  
  // Handle basic structure preview (first pass from progressive capture)
  if (msg.type === 'component-basic-structure') {
    try {
      // Create a temporary preview from basic structure
      const basicData = msg.basicData;
      
      // Notify the UI that we received the basic structure
      figma.ui.postMessage({ 
        type: 'basic-structure-received', 
        success: true 
      });
      
      // Create a simple preview frame (this will be replaced when full data arrives)
      const previewFrame = createBasicPreview(basicData);
      
      // Store the ID for later replacement
      if (previewFrame) {
        figma.ui.postMessage({ 
          type: 'preview-created',
          previewId: previewFrame.id
        });
      }
    } catch (error) {
      console.error("Error creating preview:", error);
      figma.ui.postMessage({ 
        type: 'preview-error', 
        message: error.message 
      });
    }
  }
  // Handle chunked data start message
  else if (msg.type === 'component-chunked-start') {
    try {
      const metadata = msg.metadata;
      
      if (!metadata || !metadata.id) {
        throw new Error('Invalid component metadata');
      }
      
      // Initialize storage for the chunks
      chunkedComponents[metadata.id] = {
        metadata: metadata,
        chunks: new Array(metadata.totalChunks),
        receivedChunks: 0
      };
      
      // Notify UI that we're ready to receive chunks
      figma.ui.postMessage({ 
        type: 'chunked-start-received', 
        componentId: metadata.id,
        success: true 
      });
      
      // Create a preliminary placeholder
      createChunkedPlaceholder(metadata);
      
    } catch (error) {
      console.error("Error preparing for chunked data:", error);
      figma.ui.postMessage({ 
        type: 'chunked-error', 
        message: error.message 
      });
    }
  }
  // Handle individual chunk of data
  else if (msg.type === 'component-chunked-data') {
    try {
      const { componentId, chunkIndex, data, totalChunks } = msg;
      
      if (!componentId || !chunkedComponents[componentId]) {
        throw new Error('Received chunk for unknown component');
      }
      
      // Store the chunk
      const componentData = chunkedComponents[componentId];
      componentData.chunks[chunkIndex] = data;
      componentData.receivedChunks++;
      
      // Update progress
      const progress = Math.round((componentData.receivedChunks / totalChunks) * 100);
      figma.ui.postMessage({ 
        type: 'chunked-progress', 
        componentId: componentId,
        progress: progress 
      });
      
    } catch (error) {
      console.error("Error processing data chunk:", error);
      figma.ui.postMessage({ 
        type: 'chunked-error', 
        message: error.message 
      });
    }
  }
  // Handle completion of chunked data
  else if (msg.type === 'component-chunked-complete') {
    try {
      const { componentId } = msg;
      
      if (!componentId || !chunkedComponents[componentId]) {
        throw new Error('Completion signal for unknown component');
      }
      
      // Reassemble the full component data
      console.log('Reassembling chunked component...');
      
      const componentData = chunkedComponents[componentId];
      const fullDataString = componentData.chunks.join('');
      const figmaData = JSON.parse(fullDataString);
      
      // Process the reassembled data
      await createElementsFromFigmaData(figmaData);
      
      // Clean up
      delete chunkedComponents[componentId];
      
      // Notify UI of completion
      figma.ui.postMessage({ 
        type: 'chunked-complete', 
        success: true,
        componentId: componentId
      });
      
    } catch (error) {
      console.error("Error completing chunked data processing:", error);
      figma.ui.postMessage({ 
        type: 'chunked-error', 
        message: error.message 
      });
    }
  }
  // Standard data handling
  else if (msg.type === 'paste-data') {
    try {
      // Parse the incoming Figma-compatible JSON data
      const figmaData = msg.figmaData;
      
      // Process the Figma data and create elements
      await createElementsFromFigmaData(figmaData);
      
      // Notify the UI that processing was successful
      figma.ui.postMessage({ type: 'creation-complete', success: true });
    } catch (error) {
      // If there's an error, notify the UI
      console.error("Error creating elements:", error);
      figma.ui.postMessage({ 
        type: 'creation-error', 
        message: error.message 
      });
    }
  } else if (msg.type === 'cancel') {
    // Close the plugin when the user cancels
    figma.closePlugin();
  }
};

/**
 * Create a basic preview frame from initial structure data
 * This gives immediate visual feedback while full component data is being processed
 */
function createBasicPreview(basicData) {
  try {
    // Create a frame to represent the component
    const frame = figma.createFrame();
    frame.name = basicData.name || "Component Preview";
    
    // Set size and position
    frame.resize(
      basicData.width || 100, 
      basicData.height || 100
    );
    
    // Apply any available style properties
    if (basicData.backgroundColor) {
      const rgbColor = parseRgbColor(basicData.backgroundColor);
      if (rgbColor) {
        const fills = clone(frame.fills);
        fills.push({
          type: 'SOLID',
          color: rgbColor,
          opacity: 1
        });
        frame.fills = fills;
      }
    }
    
    if (basicData.cornerRadius) {
      frame.cornerRadius = basicData.cornerRadius;
    }
    
    // If there's text content, add it as a placeholder
    if (basicData.text) {
      createTextPreview(basicData.text, frame);
    }
    
    // Add a loading indicator
    addLoadingIndicator(frame, "Loading full component...");
    
    // Add to the current page
    figma.currentPage.appendChild(frame);
    figma.currentPage.selection = [frame];
    
    return frame;
  } catch (error) {
    console.error("Error creating basic preview:", error);
    return null;
  }
}

/**
 * Create a text node preview with the given content
 */
async function createTextPreview(textContent, parent) {
  try {
    // Load a common font that's likely available
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    
    const textNode = figma.createText();
    textNode.characters = textContent;
    textNode.fontSize = 14;
    textNode.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    
    // Position it within the parent
    const padding = 16;
    textNode.x = padding;
    textNode.y = padding;
    textNode.resize(
      Math.min(parent.width - (padding * 2), 300),
      textNode.height
    );
    
    parent.appendChild(textNode);
    return textNode;
  } catch (error) {
    console.error("Error creating text preview:", error);
    return null;
  }
}

/**
 * Create a placeholder for chunked component data
 */
function createChunkedPlaceholder(metadata) {
  try {
    // Create a frame to represent the loading component
    const frame = figma.createFrame();
    frame.name = metadata.name || "Loading Large Component";
    
    // Set size and position
    frame.resize(
      metadata.width || 200, 
      metadata.height || 200
    );
    
    // Apply any available style properties
    if (metadata.mainFill) {
      const fills = clone(frame.fills);
      fills.push(metadata.mainFill);
      frame.fills = fills;
    } else {
      // Default fill
      const fills = clone(frame.fills);
      fills.push({
        type: 'SOLID',
        color: { r: 0.9, g: 0.9, b: 0.9 },
        opacity: 1
      });
      frame.fills = fills;
    }
    
    if (metadata.cornerRadius) {
      frame.cornerRadius = metadata.cornerRadius;
    }
    
    // Add a progress indicator
    const progressText = `Loading large component (${metadata.sizeKB}KB)...`;
    addLoadingIndicator(frame, progressText);
    
    // Add to the current page
    figma.currentPage.appendChild(frame);
    figma.currentPage.selection = [frame];
    
    // Store the frame ID in the chunked component data for later updating
    chunkedComponents[metadata.id].frameId = frame.id;
    
    return frame;
  } catch (error) {
    console.error("Error creating chunked placeholder:", error);
    return null;
  }
}

/**
 * Add a loading indicator to a frame
 */
async function addLoadingIndicator(frame, message) {
  try {
    // Load a common font
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    
    // Create a loading message
    const loadingText = figma.createText();
    loadingText.characters = message;
    loadingText.fontSize = 12;
    loadingText.fills = [{ type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.3 } }];
    
    // Center in the frame
    loadingText.x = (frame.width - loadingText.width) / 2;
    loadingText.y = (frame.height - loadingText.height) / 2;
    
    frame.appendChild(loadingText);
    return loadingText;
  } catch (error) {
    console.error("Error adding loading indicator:", error);
    return null;
  }
}

/**
 * Parse an RGB color string into a Figma color object
 */
function parseRgbColor(colorString) {
  try {
    // Handle rgb(r, g, b) format
    const rgbMatch = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]) / 255,
        g: parseInt(rgbMatch[2]) / 255,
        b: parseInt(rgbMatch[3]) / 255
      };
    }
    
    // Handle rgba(r, g, b, a) format
    const rgbaMatch = colorString.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d\.]+)\)/);
    if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1]) / 255,
        g: parseInt(rgbaMatch[2]) / 255,
        b: parseInt(rgbaMatch[3]) / 255,
        opacity: parseFloat(rgbaMatch[4])
      };
    }
    
    // Handle hex format
    if (colorString.startsWith('#')) {
      let hex = colorString.substring(1);
      if (hex.length === 3) {
        hex = hex.split('').map(h => h + h).join('');
      }
      return {
        r: parseInt(hex.substring(0, 2), 16) / 255,
        g: parseInt(hex.substring(2, 4), 16) / 255,
        b: parseInt(hex.substring(4, 6), 16) / 255
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error parsing color:", error);
    return null;
  }
}

/**
 * Clone a Figma property to avoid reference issues
 */
function clone(val) {
  return JSON.parse(JSON.stringify(val || []));
}

// Function to create Figma elements from the JSON data
async function createElementsFromFigmaData(data) {
  // Get the current selection or use the current page
  const nodes = [];
  
  // Process the data according to Figma's structure
  if (data && data.figma && data.figma.nodes) {
    const figmaNodes = data.figma.nodes;
    
    // Create a frame to hold all elements if there are multiple nodes
    const frame = figma.createFrame();
    frame.name = "Pasted Design";
    frame.resize(800, 600);
    
    // Process each node from the Figma data
    for (const nodeId in figmaNodes) {
      const nodeData = figmaNodes[nodeId];
      const node = await createNode(nodeData, frame);
      if (node) {
        nodes.push(node);
      }
    }
    
    // Add the frame to the selection
    figma.currentPage.appendChild(frame);
    figma.currentPage.selection = [frame];
    
    // Adjust the frame size to fit the content
    const padding = 40;
    frame.resize(
      Math.max(...nodes.map(n => n.x + n.width)) + padding,
      Math.max(...nodes.map(n => n.y + n.height)) + padding
    );
  } else {
    throw new Error("Invalid Figma data format");
  }
}

// Helper function to create a node based on its type
async function createNode(nodeData, parent) {
  let node;
  
  // Load any required fonts
  if (nodeData.type === "TEXT" && nodeData.fontName) {
    await figma.loadFontAsync(nodeData.fontName);
  }
  
  // Create the appropriate node type
  switch (nodeData.type) {
    case "FRAME":
      node = figma.createFrame();
      break;
    case "RECTANGLE":
      node = figma.createRectangle();
      break;
    case "TEXT":
      node = figma.createText();
      if (nodeData.characters) {
        node.characters = nodeData.characters;
      }
      break;
    case "COMPONENT":
      node = figma.createComponent();
      break;
    case "GROUP":
      node = figma.group([], parent);
      break;
    default:
      console.warn(`Unsupported node type: ${nodeData.type}`);
      return null;
  }
  
  // Set common properties
  if (nodeData.name) {
    node.name = nodeData.name;
  }
  
  // Apply positioning
  if (nodeData.x !== undefined) node.x = nodeData.x;
  if (nodeData.y !== undefined) node.y = nodeData.y;
  if (nodeData.width !== undefined && nodeData.height !== undefined) {
    node.resize(nodeData.width, nodeData.height);
  }
  
  // Apply fills
  if (nodeData.fills && nodeData.fills.length > 0) {
    node.fills = nodeData.fills.map(fill => {
      if (fill.type === "SOLID") {
        return {
          type: "SOLID",
          color: fill.color || { r: 1, g: 1, b: 1 },
          opacity: fill.opacity !== undefined ? fill.opacity : 1
        };
      }
      return fill;
    });
  }
  
  // Apply strokes
  if (nodeData.strokes && nodeData.strokes.length > 0) {
    node.strokes = nodeData.strokes;
  }
  
  // Process children if they exist
  if (nodeData.children && nodeData.children.length > 0) {
    for (const childId of nodeData.children) {
      if (figmaNodes[childId]) {
        const childNode = await createNode(figmaNodes[childId], node);
        if (childNode) {
          node.appendChild(childNode);
        }
      }
    }
  }
  
  // Add the node to the parent
  if (parent && node) {
    parent.appendChild(node);
  }
  
  return node;
}

/**
 * ===== CORE VISIONARY UI PROCESSING FUNCTIONS =====
 * These functions implement the semantic accuracy approach for creating designer-ready components
 */

/**
 * Main function to process image analysis results and create Figma components
 * Implements the full Visionary UI pipeline with semantic accuracy
 */
async function processImageAnalysisResults(imageData) {
  try {
    figma.notify('🔍 Processing image analysis...', { timeout: 1000 });
    
    // Create parent frame with proper Auto Layout
    const parentFrame = figma.createFrame();
    parentFrame.name = 'Visionary UI Analysis';
    parentFrame.layoutMode = 'VERTICAL';
    parentFrame.counterAxisSizingMode = 'AUTO';
    parentFrame.primaryAxisSizingMode = 'AUTO';
    parentFrame.itemSpacing = 24;
    parentFrame.paddingLeft = 32;
    parentFrame.paddingRight = 32;
    parentFrame.paddingTop = 32;
    parentFrame.paddingBottom = 32;
    parentFrame.fills = [{type: 'SOLID', color: {r: 0.98, g: 0.98, b: 0.98}}];
    
    // 1. Create Color Palette (if available)
    if (imageData.colors && imageData.colors.length > 0) {
      figma.notify('🎨 Creating color palette...', { timeout: 1000 });
      const colorSection = await createColorPalette(imageData.colors);
      parentFrame.appendChild(colorSection);
    }
    
    // 2. Create Typography Styles (if available)
    if (imageData.typography && imageData.typography.length > 0) {
      figma.notify('📝 Processing typography...', { timeout: 1000 });
      const typoSection = await createTypographySection(imageData.typography);
      parentFrame.appendChild(typoSection);
    }
    
    // 3. Create UI Components (main feature)
    if (imageData.components && imageData.components.length > 0) {
      figma.notify('🔧 Building UI components...', { timeout: 1000 });
      const componentSection = await createComponentsSection(imageData.components);
      parentFrame.appendChild(componentSection);
    }
    
    // Add to current page
    figma.currentPage.appendChild(parentFrame);
    
    return parentFrame;
    
  } catch (error) {
    console.error('Error in processImageAnalysisResults:', error);
    throw error;
  }
}

/**
 * Convert external data from Chrome extension to our internal format
 */
function convertExternalData(externalData) {
  // Handle different data formats from Chrome extension
  if (externalData.imageAnalysis) {
    return externalData.imageAnalysis;
  }
  
  // Convert direct component data
  return {
    components: Array.isArray(externalData) ? externalData : [externalData],
    colors: externalData.colors || [],
    typography: externalData.typography || []
  };
}

/**
 * Create a color palette section with semantic naming
 */
async function createColorPalette(colors) {
  const colorSection = figma.createFrame();
  colorSection.name = 'Color Palette';
  colorSection.layoutMode = 'VERTICAL';
  colorSection.counterAxisSizingMode = 'AUTO';
  colorSection.primaryAxisSizingMode = 'AUTO';
  colorSection.itemSpacing = 16;
  colorSection.fills = [];
  
  // Add title
  const title = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  title.fontName = { family: "Inter", style: "Bold" };
  title.characters = "Color Styles";
  title.fontSize = 16;
  colorSection.appendChild(title);
  
  // Create color row
  const colorRow = figma.createFrame();
  colorRow.name = 'Colors';
  colorRow.layoutMode = 'HORIZONTAL';
  colorRow.counterAxisSizingMode = 'AUTO';
  colorRow.primaryAxisSizingMode = 'AUTO';
  colorRow.itemSpacing = 12;
  colorRow.fills = [];
  
  // Create color swatches
  for (let i = 0; i < Math.min(colors.length, 8); i++) { // Limit to 8 colors
    const colorData = colors[i];
    const swatch = await createColorSwatch(colorData, i);
    colorRow.appendChild(swatch);
  }
  
  colorSection.appendChild(colorRow);
  return colorSection;
}

/**
 * Create individual color swatch with style
 */
async function createColorSwatch(colorData, index) {
  const wrapper = figma.createFrame();
  wrapper.name = `Color-${colorData.name || index}`;
  wrapper.layoutMode = 'VERTICAL';
  wrapper.counterAxisSizingMode = 'AUTO';
  wrapper.primaryAxisSizingMode = 'AUTO';
  wrapper.itemSpacing = 4;
  wrapper.fills = [];
  
  // Create swatch
  const rect = figma.createRectangle();
  rect.name = colorData.name || `Color ${index + 1}`;
  rect.resize(48, 48);
  rect.cornerRadius = 4;
  
  // Create paint
  const paint = {
    type: 'SOLID',
    color: colorData.color || { r: Math.random(), g: Math.random(), b: Math.random() },
    opacity: colorData.opacity || 1
  };
  rect.fills = [paint];
  
  // Create label
  const label = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  label.fontName = { family: "Inter", style: "Regular" };
  label.characters = colorData.name || `Color ${index + 1}`;
  label.fontSize = 11;
  label.textAlignHorizontal = 'CENTER';
  
  wrapper.appendChild(rect);
  wrapper.appendChild(label);
  return wrapper;
}

/**
 * Create typography section with text styles
 */
async function createTypographySection(typography) {
  const typoSection = figma.createFrame();
  typoSection.name = 'Typography';
  typoSection.layoutMode = 'VERTICAL';
  typoSection.counterAxisSizingMode = 'AUTO';
  typoSection.primaryAxisSizingMode = 'AUTO';
  typoSection.itemSpacing = 16;
  typoSection.fills = [];
  
  // Add title
  const title = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  title.fontName = { family: "Inter", style: "Bold" };
  title.characters = "Text Styles";
  title.fontSize = 16;
  typoSection.appendChild(title);
  
  // Group typography by similar properties
  const uniqueStyles = getUniqueTextStyles(typography);
  
  // Create samples for each unique style
  for (const style of uniqueStyles) {
    const textSample = await createTextSample(style);
    typoSection.appendChild(textSample);
  }
  
  return typoSection;
}

/**
 * Get unique text styles from typography data
 */
function getUniqueTextStyles(typography) {
  const styleMap = new Map();
  
  typography.forEach(text => {
    const key = `${text.fontSize || 16}-${text.fontFamily || 'Inter'}`;
    if (!styleMap.has(key)) {
      styleMap.set(key, {
        fontSize: text.fontSize || 16,
        fontFamily: text.fontFamily || 'Inter',
        text: text.text || 'Sample Text',
        fontWeight: text.fontWeight || 'Regular'
      });
    }
  });
  
  return Array.from(styleMap.values());
}

/**
 * Create text sample with proper styling
 */
async function createTextSample(style) {
  const text = figma.createText();
  
  // Load font safely
  try {
    await figma.loadFontAsync({ family: style.fontFamily, style: style.fontWeight });
    text.fontName = { family: style.fontFamily, style: style.fontWeight };
  } catch (error) {
    // Fallback to Inter if font loading fails
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    text.fontName = { family: "Inter", style: "Regular" };
  }
  
  text.characters = style.text || `${style.fontFamily} ${style.fontSize}px`;
  text.fontSize = style.fontSize;
  
  return text;
}

/**
 * Create components section with Auto Layout and semantic naming
 */
async function createComponentsSection(components) {
  const componentSection = figma.createFrame();
  componentSection.name = 'UI Components';
  componentSection.layoutMode = 'VERTICAL';
  componentSection.counterAxisSizingMode = 'AUTO';
  componentSection.primaryAxisSizingMode = 'AUTO';
  componentSection.itemSpacing = 24;
  componentSection.fills = [];
  
  // Add title
  const title = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  title.fontName = { family: "Inter", style: "Bold" };
  title.characters = "UI Components";
  title.fontSize = 16;
  componentSection.appendChild(title);
  
  // Create components with semantic accuracy
  for (let i = 0; i < components.length; i++) {
    try {
      const component = await createSemanticComponent(components[i], i);
      componentSection.appendChild(component);
    } catch (error) {
      console.error(`Error creating component ${i}:`, error);
      // Create fallback component
      const fallback = createFallbackComponent(components[i], i);
      componentSection.appendChild(fallback);
    }
  }
  
  return componentSection;
}

/**
 * Create semantic component with designer intent
 */
async function createSemanticComponent(compData, index) {
  // Determine component type based on semantic analysis
  const componentType = determineComponentType(compData);
  
  let component;
  
  switch (componentType) {
    case 'button':
      component = await createButtonComponent(compData);
      break;
    case 'card':
      component = await createCardComponent(compData);
      break;
    case 'input':
      component = await createInputComponent(compData);
      break;
    default:
      component = await createGenericComponent(compData);
  }
  
  // Apply semantic naming
  component.name = generateSemanticName(compData, componentType, index);
  
  return component;
}

/**
 * Determine component type based on semantic analysis
 */
function determineComponentType(compData) {
  const name = (compData.name || '').toLowerCase();
  const type = (compData.type || '').toLowerCase();
  
  if (name.includes('button') || type.includes('button')) return 'button';
  if (name.includes('card') || type.includes('card')) return 'card';
  if (name.includes('input') || type.includes('input')) return 'input';
  if (name.includes('text') || type.includes('text')) return 'text';
  
  return 'frame';
}

/**
 * Generate semantic component name
 */
function generateSemanticName(compData, componentType, index) {
  if (compData.name && !compData.name.includes('div') && !compData.name.includes('element')) {
    return compData.name;
  }
  
  // Generate semantic name based on type
  const typeMap = {
    'button': 'Button',
    'card': 'Card',
    'input': 'Input Field',
    'text': 'Text Element',
    'frame': 'Component'
  };
  
  return `${typeMap[componentType] || 'Component'} ${index + 1}`;
}

/**
 * Create button component with proper styling
 */
async function createButtonComponent(compData) {
  const button = figma.createComponent();
  button.resize(compData.width || 120, compData.height || 40);
  button.cornerRadius = 8; // Standard button radius
  button.layoutMode = 'HORIZONTAL';
  button.counterAxisSizingMode = 'AUTO';
  button.primaryAxisSizingMode = 'AUTO';
  button.itemSpacing = 8;
  button.paddingLeft = 16;
  button.paddingRight = 16;
  button.paddingTop = 12;
  button.paddingBottom = 12;
  
  // Apply fills if available
  if (compData.fills && compData.fills.length > 0) {
    button.fills = compData.fills;
  } else {
    button.fills = [{type: 'SOLID', color: {r: 0.2, g: 0.4, b: 1}}]; // Default blue
  }
  
  // Add text if available
  if (compData.text) {
    const buttonText = figma.createText();
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    buttonText.fontName = { family: "Inter", style: "Medium" };
    buttonText.characters = compData.text;
    buttonText.fontSize = 14;
    buttonText.fills = [{type: 'SOLID', color: {r: 1, g: 1, b: 1}}]; // White text
    button.appendChild(buttonText);
  }
  
  return button;
}

/**
 * Create card component with proper structure
 */
async function createCardComponent(compData) {
  const card = figma.createComponent();
  card.resize(compData.width || 280, compData.height || 200);
  card.cornerRadius = 12; // Standard card radius
  card.layoutMode = 'VERTICAL';
  card.counterAxisSizingMode = 'AUTO';
  card.primaryAxisSizingMode = 'AUTO';
  card.itemSpacing = 16;
  card.paddingLeft = 20;
  card.paddingRight = 20;
  card.paddingTop = 20;
  card.paddingBottom = 20;
  
  // Card background
  card.fills = [{type: 'SOLID', color: {r: 1, g: 1, b: 1}}];
  card.effects = [{
    type: 'DROP_SHADOW',
    color: {r: 0, g: 0, b: 0, a: 0.1},
    offset: {x: 0, y: 2},
    radius: 8,
    spread: 0,
    visible: true,
    blendMode: 'NORMAL'
  }];
  
  return card;
}

/**
 * Create input component
 */
async function createInputComponent(compData) {
  const input = figma.createComponent();
  input.resize(compData.width || 200, compData.height || 40);
  input.cornerRadius = 6;
  input.fills = [{type: 'SOLID', color: {r: 1, g: 1, b: 1}}];
  input.strokes = [{type: 'SOLID', color: {r: 0.8, g: 0.8, b: 0.8}}];
  input.strokeWeight = 1;
  
  return input;
}

/**
 * Create generic component
 */
async function createGenericComponent(compData) {
  const component = figma.createComponent();
  component.resize(compData.width || 100, compData.height || 100);
  
  // Apply properties if available
  if (compData.fills) component.fills = compData.fills;
  if (compData.strokes) component.strokes = compData.strokes;
  if (compData.cornerRadius) component.cornerRadius = compData.cornerRadius;
  
  return component;
}

/**
 * Create fallback component when main creation fails
 */
function createFallbackComponent(compData, index) {
  const fallback = figma.createRectangle();
  fallback.name = `Component ${index + 1} (Fallback)`;
  fallback.resize(compData.width || 100, compData.height || 100);
  fallback.fills = [{type: 'SOLID', color: {r: 0.9, g: 0.9, b: 0.9}}];
  return fallback;
}
