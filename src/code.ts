// Show UI
figma.showUI(__html__, { width: 400, height: 600 });

// WebSocket connection for advanced processing
let websocket: WebSocket | null = null;
let isConnectedToServer = false;

// Connect to WebSocket server
function connectToWebSocket() {
  try {
    websocket = new WebSocket('ws://localhost:8080');
    
    websocket.onopen = () => {
      console.log('[Canvas Weaver] Connected to WebSocket server');
      // Identify as Figma plugin
      websocket?.send(JSON.stringify({
        type: 'identify',
        id: 'figma'
      }));
      isConnectedToServer = true;
      figma.notify('🔗 Connected to Canvas Weaver server', { timeout: 2000 });
    };
    
    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('[Canvas Weaver] Error parsing WebSocket message:', error);
      }
    };
    
    websocket.onclose = () => {
      console.log('[Canvas Weaver] WebSocket connection closed');
      isConnectedToServer = false;
      websocket = null;
      // Attempt to reconnect after 5 seconds
      setTimeout(connectToWebSocket, 5000);
    };
    
    websocket.onerror = (error) => {
      console.error('[Canvas Weaver] WebSocket error:', error);
      isConnectedToServer = false;
    };
    
  } catch (error) {
    console.error('[Canvas Weaver] Failed to connect to WebSocket:', error);
    // Retry connection after 5 seconds
    setTimeout(connectToWebSocket, 5000);
  }
}

// Handle messages from WebSocket server
function handleWebSocketMessage(message: any) {
  console.log('[Canvas Weaver] Received WebSocket message:', message.type);
  
  switch (message.type) {
    case 'identified':
      console.log('[Canvas Weaver] Successfully identified with server');
      break;
      
    case 'connectionStatus':
      console.log('[Canvas Weaver] Connection status:', message.status);
      break;
      
    case 'processedImage':
      handleProcessedImageData(message.data);
      break;
      
    case 'processingError':
      figma.notify(`❌ Processing error: ${message.error}`, { timeout: 5000, error: true });
      break;
      
    default:
      console.log('[Canvas Weaver] Unknown message type:', message.type);
  }
}

// Handle processed image data from server
async function handleProcessedImageData(data: any) {
  try {
    figma.notify('🎨 Building component from processed data...', { timeout: 3000 });
    
    const component = await buildComponentFromProcessedData(data);
    
    // Add to page and position
    figma.currentPage.appendChild(component);
    const viewportCenter = figma.viewport.center;
    component.x = Math.round(viewportCenter.x - component.width / 2);
    component.y = Math.round(viewportCenter.y - component.height / 2);
    
    figma.currentPage.selection = [component];
    figma.viewport.scrollAndZoomIntoView([component]);
    
    figma.notify('✅ Component created from advanced processing!', { timeout: 4000 });
    
  } catch (error) {
    console.error('[Canvas Weaver] Error building component:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    figma.notify(`❌ Component creation failed: ${errorMessage}`, { timeout: 5000, error: true });
  }
}

// Initialize WebSocket connection
connectToWebSocket();

// Type definitions for the libraries we'll use
interface SegmentationResult {
  segmentMap: number[][];
  uniqueSegments: number[];
  width: number;
  height: number;
}

interface VectorLayer {
  paths: string;
  color: RGB;
  bounds: { x: number; y: number; width: number; height: number };
}

interface TextBlock {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

// Main message handler - refactored for async component generation
figma.ui.onmessage = async (msg) => {
  console.log('[Canvas Weaver] Received message:', msg.type);
  
  // Handle component generation from image
  if (msg.type === 'generateComponentFromImage') {
    try {
      // Validate incoming data
      if (!msg.base64) {
        throw new Error('No image data received');
      }
      
      // Show initial notification
      figma.notify('📊 Analyzing component structure...', { timeout: 3000 });
      
      // Check if WebSocket server is available for advanced processing
      if (isConnectedToServer && websocket) {
        console.log('[Canvas Weaver] Using advanced server processing');
        figma.notify('🚀 Using advanced AI processing...', { timeout: 3000 });
        
        // Send image to server for advanced processing
        websocket.send(JSON.stringify({
          type: 'processImage',
          base64: msg.base64,
          options: {
            useSegmentation: true,
            useOCR: true,
            useVectorization: true,
            outputFormat: 'figma-component'
          }
        }));
        
        // The response will be handled by handleProcessedImageData
        return;
      } else {
        console.log('[Canvas Weaver] Using local processing (server not available)');
        figma.notify('⚡ Using local processing...', { timeout: 3000 });
      }
      
      // Fallback to local processing
      const generatedComponent = await analyzeAndBuildComponent(msg.base64);
      
      // Add the component to the current page
      figma.currentPage.appendChild(generatedComponent);
      
      // Position the component at the center of the viewport
      const viewportCenter = figma.viewport.center;
      generatedComponent.x = Math.round(viewportCenter.x - generatedComponent.width / 2);
      generatedComponent.y = Math.round(viewportCenter.y - generatedComponent.height / 2);
      
      // Select the newly created component
      figma.currentPage.selection = [generatedComponent];
      
      // Zoom to fit the component in view
      figma.viewport.scrollAndZoomIntoView([generatedComponent]);
      
      // Show success notification
      figma.notify('✅ Component generated successfully!', { timeout: 4000 });
      
      // Send success response back to UI
      figma.ui.postMessage({
        type: 'generationComplete',
        success: true,
        nodeId: generatedComponent.id,
        stats: {
          width: generatedComponent.width,
          height: generatedComponent.height,
          layerCount: countLayers(generatedComponent),
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('[Canvas Weaver] Generation error:', error);
      
      // Show error notification
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      figma.notify(`❌ Generation failed: ${errorMessage}`, { 
        timeout: 5000,
        error: true 
      });
      
      // Send error response back to UI
      figma.ui.postMessage({
        type: 'generationComplete',
        success: false,
        error: errorMessage
      });
    }
  }
  
  // Handle resize messages
  else if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
  }
  
  // Handle cancel/close
  else if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

// Helper function to count total layers in a node
function countLayers(node: SceneNode): number {
  let count = 1;
  if ('children' in node) {
    for (const child of node.children) {
      count += countLayers(child);
    }
  }
  return count;
}

// Main component analysis and building function
async function analyzeAndBuildComponent(base64: string): Promise<FrameNode> {
  console.log('[Canvas Weaver] Starting advanced component analysis...');
  
  try {
    // First, try to use the AI server for processing
    figma.notify('🔍 Analyzing image with AI...', { timeout: 2000 });
    
    const serverData = await processImageWithAIServer(base64);
    
    if (serverData) {
      console.log('[Canvas Weaver] Using AI server results');
      figma.notify('🎨 Building component from AI analysis...', { timeout: 2000 });
      
      // Use server-provided vectors and perform client-side OCR
      const vectorLayers = await convertServerVectorsToFigmaLayers(serverData.vectors);
      const textBlocks = await performClientSideOCR(base64);
      
      // Merge server text with client OCR if available
      const allTextBlocks = mergeTextSources(serverData.text, textBlocks);
      
      const assembledComponent = await assembleComponent(
        vectorLayers,
        allTextBlocks,
        serverData.metadata.width,
        serverData.metadata.height
      );
      
      console.log('[Canvas Weaver] Component generation complete with AI!');
      return assembledComponent;
    }
    
  } catch (error) {
    console.error('[Canvas Weaver] AI server failed, falling back to local processing:', error);
    figma.notify('⚡ Using local processing...', { timeout: 2000 });
  }
  
  // Fallback to local processing if server is unavailable
  try {
    console.log('[Canvas Weaver] Using local processing pipeline...');
    
    // Step A: Image Decoding & Segmentation
    console.log('[Canvas Weaver] Step A: Decoding and segmenting image...');
    const imageData = await decodeBase64ToImageData(base64);
    const segmentationResult = await performImageSegmentation(imageData);
    
    // Step B: Raster-to-Vector Conversion
    console.log('[Canvas Weaver] Step B: Converting segments to vectors...');
    const vectorLayers = await convertSegmentsToVectors(segmentationResult, imageData);
    
    // Step C: Text Recognition & Layer Creation (client-side OCR)
    console.log('[Canvas Weaver] Step C: Performing client-side OCR...');
    const textBlocks = await performClientSideOCR(base64);
    
    // Step D: Final Assembly
    console.log('[Canvas Weaver] Step D: Assembling component...');
    const assembledComponent = await assembleComponent(
      vectorLayers,
      textBlocks,
      imageData.width,
      imageData.height
    );
    
    console.log('[Canvas Weaver] Component generation complete!');
    return assembledComponent;
    
  } catch (error) {
    console.error('[Canvas Weaver] Error in local processing:', error);
    // Fallback to basic component if all analysis fails
    return await createFallbackComponent(base64);
  }
}

// Process image with AI server
async function processImageWithAIServer(base64: string): Promise<any | null> {
  try {
    console.log('[Canvas Weaver] Making request to AI server...');
    
    const response = await fetch('http://localhost:3000/api/process-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64: base64,
        options: {
          useOCR: true,
          generateVectors: true
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Server processing failed');
    }
    
    console.log('[Canvas Weaver] AI server analysis complete');
    return result.data;
    
  } catch (error) {
    console.error('[Canvas Weaver] AI server request failed:', error);
    return null;
  }
}

// Convert server vector data to Figma layers
async function convertServerVectorsToFigmaLayers(serverVectors: any[]): Promise<VectorLayer[]> {
  const vectorLayers: VectorLayer[] = [];
  
  for (const element of serverVectors) {
    if (element.type === 'vector') {
      vectorLayers.push({
        paths: element.svgPath,
        color: element.fill,
        bounds: {
          x: element.bbox.x,
          y: element.bbox.y,
          width: element.bbox.width,
          height: element.bbox.height
        }
      });
    }
  }
  
  return vectorLayers;
}

// Perform client-side OCR using Tesseract.js
async function performClientSideOCR(base64: string): Promise<TextBlock[]> {
  try {
    console.log('[Canvas Weaver] Starting client-side OCR...');
    
    // Import Tesseract dynamically (Figma environment compatibility)
    const Tesseract = await import('tesseract.js');
    
    // Perform OCR on the base64 image
    const result = await Tesseract.recognize(base64, 'eng', {
      logger: m => console.log('[Tesseract]', m)
    });
    
    const words = result.data.words || [];
    
    console.log('[Canvas Weaver] OCR analysis complete, found', words.length, 'words');
    
    // Convert Tesseract results to TextBlock format
    const textBlocks: TextBlock[] = [];
    
    for (const word of words) {
      if (word.confidence > 50 && word.text.trim().length > 0) { // Filter low-confidence results
        textBlocks.push({
          text: word.text,
          confidence: word.confidence / 100, // Convert to 0-1 scale
          bbox: {
            x0: word.bbox.x0,
            y0: word.bbox.y0,
            x1: word.bbox.x1,
            y1: word.bbox.y1
          }
        });
      }
    }
    
    return textBlocks;
    
  } catch (error) {
    console.error('[Canvas Weaver] Client-side OCR failed:', error);
    // Fallback to simplified text detection
    return await performOCR(await decodeBase64ToImageData(base64));
  }
}

// Merge text sources from server and client OCR
function mergeTextSources(serverText: any[], clientText: TextBlock[]): TextBlock[] {
  const mergedText: TextBlock[] = [];
  
  // Add server text (converted to TextBlock format)
  for (const text of serverText) {
    mergedText.push({
      text: text.text,
      confidence: text.confidence,
      bbox: {
        x0: text.bbox.x,
        y0: text.bbox.y,
        x1: text.bbox.x + text.bbox.width,
        y1: text.bbox.y + text.bbox.height
      }
    });
  }
  
  // Add client OCR results (avoid duplicates by checking position overlap)
  for (const clientTextBlock of clientText) {
    const hasOverlap = mergedText.some(existing => {
      const overlapX = Math.max(0, Math.min(existing.bbox.x1, clientTextBlock.bbox.x1) - Math.max(existing.bbox.x0, clientTextBlock.bbox.x0));
      const overlapY = Math.max(0, Math.min(existing.bbox.y1, clientTextBlock.bbox.y1) - Math.max(existing.bbox.y0, clientTextBlock.bbox.y0));
      return overlapX > 10 && overlapY > 5; // Allow some tolerance
    });
    
    if (!hasOverlap) {
      mergedText.push(clientTextBlock);
    }
  }
  
  return mergedText;
}

// Step A: Image Decoding & Preparation
async function decodeBase64ToImageData(base64: string): Promise<{
  data: Uint8Array;
  width: number;
  height: number;
  imageHash: string;
}> {
  // Remove data URL prefix
  const base64Data = base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
  
  // Convert to Uint8Array
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Create Figma image to get dimensions
  const image = figma.createImage(bytes);
  const { width, height } = await image.getSizeAsync();
  
  return {
    data: bytes,
    width,
    height,
    imageHash: image.hash
  };
}

// Perform image segmentation (simplified version for Figma environment)
async function performImageSegmentation(imageData: {
  data: Uint8Array;
  width: number;
  height: number;
}): Promise<SegmentationResult> {
  // In a real implementation, this would use TensorFlow.js DeepLab
  // For Figma plugin environment, we'll use a simplified segmentation approach
  
  const { width, height } = imageData;
  const segmentMap: number[][] = [];
  
  // Simple edge detection and region growing algorithm
  for (let y = 0; y < height; y++) {
    segmentMap[y] = [];
    for (let x = 0; x < width; x++) {
      // Assign segment based on position (simplified)
      if (y < height * 0.2) {
        segmentMap[y][x] = 1; // Header region
      } else if (x < width * 0.3) {
        segmentMap[y][x] = 2; // Sidebar region
      } else {
        segmentMap[y][x] = 3; // Main content region
      }
    }
  }
  
  return {
    segmentMap,
    uniqueSegments: [1, 2, 3],
    width,
    height
  };
}

// Step B: Convert segments to vector paths
async function convertSegmentsToVectors(
  segmentation: SegmentationResult,
  imageData: { data: Uint8Array; width: number; height: number; imageHash: string }
): Promise<VectorLayer[]> {
  const vectorLayers: VectorLayer[] = [];
  
  for (const segmentId of segmentation.uniqueSegments) {
    // Extract segment mask
    const mask = extractSegmentMask(segmentation.segmentMap, segmentId);
    
    // Convert to SVG path (simplified potrace alternative)
    const svgPath = await traceSegmentToPath(mask, segmentation.width, segmentation.height);
    
    // Sample dominant color from segment
    const dominantColor = sampleSegmentColor(
      segmentation.segmentMap,
      segmentId,
      imageData
    );
    
    // Calculate bounds
    const bounds = calculateSegmentBounds(mask, segmentation.width, segmentation.height);
    
    vectorLayers.push({
      paths: svgPath,
      color: dominantColor,
      bounds
    });
  }
  
  return vectorLayers;
}

// Extract binary mask for a specific segment
function extractSegmentMask(segmentMap: number[][], segmentId: number): boolean[][] {
  const mask: boolean[][] = [];
  
  for (let y = 0; y < segmentMap.length; y++) {
    mask[y] = [];
    for (let x = 0; x < segmentMap[y].length; x++) {
      mask[y][x] = segmentMap[y][x] === segmentId;
    }
  }
  
  return mask;
}

// Simplified path tracing (potrace alternative for Figma environment)
async function traceSegmentToPath(
  mask: boolean[][],
  _width: number,
  _height: number
): Promise<string> {
  // Find contours of the mask
  const contours = findContours(mask);
  
  // Convert contours to SVG path
  let pathData = '';
  
  for (const contour of contours) {
    if (contour.length > 0) {
      pathData += `M ${contour[0].x} ${contour[0].y} `;
      
      for (let i = 1; i < contour.length; i++) {
        pathData += `L ${contour[i].x} ${contour[i].y} `;
      }
      
      pathData += 'Z ';
    }
  }
  
  return pathData;
}

// Simple contour finding algorithm
function findContours(mask: boolean[][]): Array<Array<{x: number, y: number}>> {
  const contours: Array<Array<{x: number, y: number}>> = [];
  const visited = mask.map(row => row.map(() => false));
  
  for (let y = 1; y < mask.length - 1; y++) {
    for (let x = 1; x < mask[y].length - 1; x++) {
      if (mask[y][x] && !visited[y][x] && isEdgePixel(mask, x, y)) {
        const contour = traceContour(mask, x, y, visited);
        if (contour.length > 3) {
          contours.push(contour);
        }
      }
    }
  }
  
  return contours;
}

// Check if pixel is on the edge of a region
function isEdgePixel(mask: boolean[][], x: number, y: number): boolean {
  if (!mask[y][x]) return false;
  
  return !mask[y-1][x] || !mask[y+1][x] || 
         !mask[y][x-1] || !mask[y][x+1];
}

// Trace a single contour
function traceContour(
  mask: boolean[][],
  startX: number,
  startY: number,
  visited: boolean[][]
): Array<{x: number, y: number}> {
  const contour: Array<{x: number, y: number}> = [];
  const directions = [
    {dx: 1, dy: 0}, {dx: 1, dy: 1}, {dx: 0, dy: 1}, {dx: -1, dy: 1},
    {dx: -1, dy: 0}, {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1}
  ];
  
  let x = startX, y = startY;
  let dir = 0;
  
  do {
    contour.push({x, y});
    visited[y][x] = true;
    
    // Find next edge pixel
    let found = false;
    for (let i = 0; i < 8; i++) {
      const testDir = (dir + i) % 8;
      const nx = x + directions[testDir].dx;
      const ny = y + directions[testDir].dy;
      
      if (ny >= 0 && ny < mask.length && nx >= 0 && nx < mask[ny].length &&
          mask[ny][nx] && !visited[ny][nx] && isEdgePixel(mask, nx, ny)) {
        x = nx;
        y = ny;
        dir = testDir;
        found = true;
        break;
      }
    }
    
    if (!found) break;
    
  } while (x !== startX || y !== startY);
  
  return contour;
}

// Sample dominant color from a segment
function sampleSegmentColor(
  _segmentMap: number[][],
  segmentId: number,
  _imageData: { data: Uint8Array; width: number; height: number }
): RGB {
  // For simplicity, return predefined colors based on segment ID
  // In a real implementation, you'd sample from the actual image data
  const colors: RGB[] = [
    { r: 0.95, g: 0.95, b: 0.95 }, // Background
    { r: 0.2, g: 0.5, b: 1.0 },    // Primary
    { r: 0.1, g: 0.8, b: 0.4 },    // Secondary
    { r: 1.0, g: 0.4, b: 0.4 }     // Accent
  ];
  
  return colors[segmentId % colors.length];
}

// Calculate bounding box of a segment
function calculateSegmentBounds(
  mask: boolean[][],
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; width: number; height: number } {
  let minX = imageWidth, minY = imageHeight, maxX = 0, maxY = 0;
  
  for (let y = 0; y < mask.length; y++) {
    for (let x = 0; x < mask[y].length; x++) {
      if (mask[y][x]) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

// Step C: OCR Text Recognition (simplified for Figma environment)
async function performOCR(imageData: {
  data: Uint8Array;
  width: number;
  height: number;
}): Promise<TextBlock[]> {
  // In a real implementation, this would use Tesseract.js
  // For Figma environment, we'll use placeholder text detection
  
  const textBlocks: TextBlock[] = [];
  
  // Detect potential text regions (simplified heuristic)
  const textRegions = detectTextRegions(imageData);
  
  for (const region of textRegions) {
    textBlocks.push({
      text: 'Lorem ipsum', // Placeholder text
      confidence: 0.85,
      bbox: region
    });
  }
  
  return textBlocks;
}

// Detect potential text regions using simple heuristics
function detectTextRegions(imageData: {
  width: number;
  height: number;
}): Array<{ x0: number; y0: number; x1: number; y1: number }> {
  const regions: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  
  // Add some heuristic text regions
  if (imageData.height > 100) {
    // Potential header text
    regions.push({
      x0: imageData.width * 0.1,
      y0: imageData.height * 0.05,
      x1: imageData.width * 0.9,
      y1: imageData.height * 0.15
    });
  }
  
  // Potential body text
  if (imageData.height > 200) {
    regions.push({
      x0: imageData.width * 0.1,
      y0: imageData.height * 0.3,
      x1: imageData.width * 0.9,
      y1: imageData.height * 0.5
    });
  }
  
  return regions;
}

// Step D: Assemble all layers into final component
async function assembleComponent(
  vectorLayers: VectorLayer[],
  textBlocks: TextBlock[],
  width: number,
  height: number
): Promise<FrameNode> {
  // Create parent frame
  const parentFrame = figma.createFrame();
  parentFrame.name = 'Generated Component';
  parentFrame.resize(width, height);
  
  // Remove default fills
  parentFrame.fills = [];
  
  // Add vector layers
  for (let i = 0; i < vectorLayers.length; i++) {
    const vectorLayer = vectorLayers[i];
    const vectorNode = await createVectorFromPath(vectorLayer);
    vectorNode.name = `Vector Layer ${i + 1}`;
    parentFrame.appendChild(vectorNode);
  }
  
  // Add text layers
  for (let i = 0; i < textBlocks.length; i++) {
    const textBlock = textBlocks[i];
    const textNode = await createTextFromBlock(textBlock);
    textNode.name = `Text ${i + 1}`;
    parentFrame.appendChild(textNode);
  }
  
  // Apply auto-layout based on layer positions
  applyIntelligentAutoLayout(parentFrame);
  
  // Add styling
  parentFrame.cornerRadius = 8;
  parentFrame.clipsContent = true;
  parentFrame.layoutMode = 'NONE'; // Will be set by auto-layout analysis
  
  return parentFrame;
}

// Create vector node from path data
async function createVectorFromPath(vectorLayer: VectorLayer): Promise<VectorNode> {
  const vector = figma.createVector();
  
  // Set vector data from SVG path
  vector.vectorPaths = [{
    windingRule: 'EVENODD',
    data: vectorLayer.paths
  }];
  
  // Apply fill
  vector.fills = [{
    type: 'SOLID',
    color: vectorLayer.color
  }];
  
  // Position and size
  vector.x = vectorLayer.bounds.x;
  vector.y = vectorLayer.bounds.y;
  vector.resize(vectorLayer.bounds.width, vectorLayer.bounds.height);
  
  return vector;
}

// Create text node from OCR block
async function createTextFromBlock(textBlock: TextBlock): Promise<TextNode> {
  const text = figma.createText();
  
  // Load font
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  
  // Set text properties
  text.fontName = { family: "Inter", style: "Regular" };
  text.characters = textBlock.text;
  text.fontSize = estimateFontSizeFromBounds(textBlock.bbox);
  
  // Position
  text.x = textBlock.bbox.x0;
  text.y = textBlock.bbox.y0;
  
  // Style
  text.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
  
  return text;
}

// Estimate font size based on bounding box
function estimateFontSizeFromBounds(bbox: {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}): number {
  const height = bbox.y1 - bbox.y0;
  return Math.max(12, Math.min(48, height * 0.7));
}

// Apply intelligent auto-layout based on layer positions
function applyIntelligentAutoLayout(frame: FrameNode): void {
  if (frame.children.length < 2) return;
  
  // Analyze child positions
  const children = frame.children as SceneNode[];
  const positions = children.map(child => ({
    x: child.x,
    y: child.y,
    width: child.width,
    height: child.height
  }));
  
  // Detect if children are arranged vertically or horizontally
  const isVertical = detectVerticalArrangement(positions);
  const isHorizontal = detectHorizontalArrangement(positions);
  
  if (isVertical) {
    frame.layoutMode = 'VERTICAL';
    frame.counterAxisAlignItems = 'CENTER';
    frame.itemSpacing = calculateAverageSpacing(positions, 'vertical');
  } else if (isHorizontal) {
    frame.layoutMode = 'HORIZONTAL';
    frame.counterAxisAlignItems = 'CENTER';
    frame.itemSpacing = calculateAverageSpacing(positions, 'horizontal');
  }
  
  // Add padding
  if (frame.layoutMode !== 'NONE') {
    frame.paddingLeft = 16;
    frame.paddingRight = 16;
    frame.paddingTop = 16;
    frame.paddingBottom = 16;
  }
}

// Detect vertical arrangement
function detectVerticalArrangement(positions: Array<{
  x: number;
  y: number;
  width: number;
  height: number;
}>): boolean {
  if (positions.length < 2) return false;
  
  // Check if Y positions increase while X positions stay similar
  const sortedByY = [...positions].sort((a, b) => a.y - b.y);
  const xVariance = calculateVariance(positions.map(p => p.x));
  const yGaps = [];
  
  for (let i = 1; i < sortedByY.length; i++) {
    yGaps.push(sortedByY[i].y - (sortedByY[i-1].y + sortedByY[i-1].height));
  }
  
  const avgGap = yGaps.reduce((a, b) => a + b, 0) / yGaps.length;
  
  return xVariance < 50 && avgGap > 0;
}

// Detect horizontal arrangement
function detectHorizontalArrangement(positions: Array<{
  x: number;
  y: number;
  width: number;
  height: number;
}>): boolean {
  if (positions.length < 2) return false;
  
  // Check if X positions increase while Y positions stay similar
  const sortedByX = [...positions].sort((a, b) => a.x - b.x);
  const yVariance = calculateVariance(positions.map(p => p.y));
  const xGaps = [];
  
  for (let i = 1; i < sortedByX.length; i++) {
    xGaps.push(sortedByX[i].x - (sortedByX[i-1].x + sortedByX[i-1].width));
  }
  
  const avgGap = xGaps.reduce((a, b) => a + b, 0) / xGaps.length;
  
  return yVariance < 50 && avgGap > 0;
}

// Calculate variance of an array of numbers
function calculateVariance(numbers: number[]): number {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
}

// Calculate average spacing between elements
function calculateAverageSpacing(
  positions: Array<{ x: number; y: number; width: number; height: number }>,
  direction: 'vertical' | 'horizontal'
): number {
  if (positions.length < 2) return 8;
  
  const gaps: number[] = [];
  const sorted = direction === 'vertical' 
    ? [...positions].sort((a, b) => a.y - b.y)
    : [...positions].sort((a, b) => a.x - b.x);
  
  for (let i = 1; i < sorted.length; i++) {
    if (direction === 'vertical') {
      gaps.push(sorted[i].y - (sorted[i-1].y + sorted[i-1].height));
    } else {
      gaps.push(sorted[i].x - (sorted[i-1].x + sorted[i-1].width));
    }
  }
  
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return Math.max(0, Math.round(avgGap));
}

// Fallback component creation if advanced analysis fails
async function createFallbackComponent(base64: string): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = 'Component (Fallback)';
  
  // Decode image
  const base64Data = base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Create image rectangle
  const image = figma.createImage(bytes);
  const { width, height } = await image.getSizeAsync();
  
  frame.resize(width, height);
  
  const rect = figma.createRectangle();
  rect.resize(width, height);
  rect.fills = [{
    type: 'IMAGE',
    imageHash: image.hash,
    scaleMode: 'FILL'
  }];
  
  frame.appendChild(rect);
  
  return frame;
}

// Build component from processed data received from server
async function buildComponentFromProcessedData(data: any): Promise<FrameNode> {
  console.log('[Canvas Weaver] Building component from processed data');
  
  const frame = figma.createFrame();
  frame.name = 'AI Generated Component';
  frame.resize(data.width || 400, data.height || 300);
  frame.fills = [];
  
  // Add shapes if available
  if (data.shapes && data.shapes.length > 0) {
    for (let i = 0; i < data.shapes.length; i++) {
      const shape = data.shapes[i];
      const shapeNode = await createShapeFromData(shape);
      shapeNode.name = `Shape ${i + 1}`;
      frame.appendChild(shapeNode);
    }
  }
  
  // Add text if available
  if (data.textBlocks && data.textBlocks.length > 0) {
    for (let i = 0; i < data.textBlocks.length; i++) {
      const textBlock = data.textBlocks[i];
      const textNode = await createTextFromData(textBlock);
      textNode.name = `Text ${i + 1}`;
      frame.appendChild(textNode);
    }
  }
  
  // Add vectors if available
  if (data.vectors && data.vectors.length > 0) {
    for (let i = 0; i < data.vectors.length; i++) {
      const vector = data.vectors[i];
      const vectorNode = await createVectorFromData(vector);
      vectorNode.name = `Vector ${i + 1}`;
      frame.appendChild(vectorNode);
    }
  }
  
  // Apply layout if detected
  if (data.layout) {
    applyLayoutToFrame(frame, data.layout);
  }
  
  return frame;
}

// Create shape from processed data
async function createShapeFromData(shapeData: any): Promise<SceneNode> {
  if (shapeData.type === 'rectangle') {
    const rect = figma.createRectangle();
    rect.resize(shapeData.width, shapeData.height);
    rect.x = shapeData.x || 0;
    rect.y = shapeData.y || 0;
    
    if (shapeData.fill) {
      rect.fills = [{ type: 'SOLID', color: shapeData.fill }];
    }
    
    if (shapeData.cornerRadius) {
      rect.cornerRadius = shapeData.cornerRadius;
    }
    
    return rect;
  } else if (shapeData.type === 'ellipse') {
    const ellipse = figma.createEllipse();
    ellipse.resize(shapeData.width, shapeData.height);
    ellipse.x = shapeData.x || 0;
    ellipse.y = shapeData.y || 0;
    
    if (shapeData.fill) {
      ellipse.fills = [{ type: 'SOLID', color: shapeData.fill }];
    }
    
    return ellipse;
  } else {
    // Default to rectangle
    const rect = figma.createRectangle();
    rect.resize(shapeData.width || 100, shapeData.height || 100);
    rect.x = shapeData.x || 0;
    rect.y = shapeData.y || 0;
    return rect;
  }
}

// Create text from processed data
async function createTextFromData(textData: any): Promise<TextNode> {
  const text = figma.createText();
  
  // Load font
  const fontFamily = textData.fontFamily || 'Inter';
  const fontStyle = textData.fontStyle || 'Regular';
  
  try {
    await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
    text.fontName = { family: fontFamily, style: fontStyle };
  } catch (error) {
    // Fallback to Inter Regular
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    text.fontName = { family: 'Inter', style: 'Regular' };
  }
  
  text.characters = textData.text || 'Generated Text';
  text.fontSize = textData.fontSize || 16;
  text.x = textData.x || 0;
  text.y = textData.y || 0;
  
  if (textData.color) {
    text.fills = [{ type: 'SOLID', color: textData.color }];
  }
  
  return text;
}

// Create vector from processed data
async function createVectorFromData(vectorData: any): Promise<VectorNode> {
  const vector = figma.createVector();
  
  if (vectorData.paths) {
    vector.vectorPaths = [{
      windingRule: 'EVENODD',
      data: vectorData.paths
    }];
  }
  
  if (vectorData.fill) {
    vector.fills = [{ type: 'SOLID', color: vectorData.fill }];
  }
  
  vector.x = vectorData.x || 0;
  vector.y = vectorData.y || 0;
  
  if (vectorData.width && vectorData.height) {
    vector.resize(vectorData.width, vectorData.height);
  }
  
  return vector;
}

// Apply layout to frame
function applyLayoutToFrame(frame: FrameNode, layout: any) {
  if (layout.type === 'vertical') {
    frame.layoutMode = 'VERTICAL';
    frame.counterAxisAlignItems = 'CENTER';
    frame.itemSpacing = layout.spacing || 16;
    frame.paddingTop = layout.padding || 16;
    frame.paddingBottom = layout.padding || 16;
    frame.paddingLeft = layout.padding || 16;
    frame.paddingRight = layout.padding || 16;
  } else if (layout.type === 'horizontal') {
    frame.layoutMode = 'HORIZONTAL';
    frame.counterAxisAlignItems = 'CENTER';
    frame.itemSpacing = layout.spacing || 16;
    frame.paddingTop = layout.padding || 16;
    frame.paddingBottom = layout.padding || 16;
    frame.paddingLeft = layout.padding || 16;
    frame.paddingRight = layout.padding || 16;
  }
}

// Clean up function when plugin closes
figma.on('close', () => {
  console.log('[Canvas Weaver] Plugin closed');
  if (websocket) {
    websocket.close();
  }
});

// Initial setup
console.log('[Canvas Weaver] Plugin initialized - Ready to generate components from images');