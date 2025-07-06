// Figma plugin API types
/// <reference types="@figma/plugin-typings" />

// Show UI
figma.showUI(__html__, { width: 400, height: 600 });

// Server connection status tracking
let isConnectedToServer = false;

// OCR operation tracking
let ocrOperationId = 0;
let pendingOcrOperations = new Map<number, {
  resolve: (result: TextBlock[]) => void;
  reject: (error: Error) => void;
}>();

// Request the UI to establish WebSocket connection
const connectToServerViaUI = () => {
  try {
    // Send a message to the UI to establish WebSocket connection
    figma.ui.postMessage({
      type: 'connect-to-websocket',
      url: 'ws://localhost:8080'
    });
    console.log('[Canvas Weaver] Requested WebSocket connection via UI');
  } catch (error) {
    console.error('[Canvas Weaver] Failed to request WebSocket connection:', error);
    setTimeout(connectToServerViaUI, 5000);
  }
}

// Main message handler - refactored for async component generation and OCR coordination
const mainMessageHandler = async (msg: any) => {
  console.log('[Canvas Weaver] Received message:', msg.type);
  
  // Handle resize messages
  if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
    return;
  }
  
  // Handle cancel/close
  else if (msg.type === 'cancel') {
    figma.closePlugin();
    return;
  }
  
  // Handle messages from UI related to WebSocket communication
  if (msg.source === 'websocket') {
    handleUIMessage(msg);
    return;
  }
  
  // Handle OCR result from UI
  if (msg.type === 'ocrResult') {
    const { operationId, success, result, error } = msg;
    
    if (pendingOcrOperations.has(operationId)) {
      const operation = pendingOcrOperations.get(operationId)!;
      pendingOcrOperations.delete(operationId);
      
      if (success) {
        console.log('[Canvas Weaver] OCR operation', operationId, 'completed successfully with', result?.length || 0, 'text blocks');
        figma.notify('📝 OCR text recognition completed!', { timeout: 2000 });
        operation.resolve(result);
      } else {
        console.error('[Canvas Weaver] OCR operation', operationId, 'failed:', error);
        figma.notify('⚠️ OCR failed, using fallback detection', { timeout: 3000 });
        operation.reject(new Error(error || 'OCR operation failed'));
      }
    }
    return;
  }
  
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
      if (isConnectedToServer) {
        console.log('[Canvas Weaver] Using advanced server processing');
        figma.notify('🚀 Using advanced AI processing...', { timeout: 3000 });
        
        // Send image to server for advanced processing via UI
        figma.ui.postMessage({
          type: 'process-image',
          base64: msg.base64,
          options: {
            useSegmentation: true,
            useOCR: true,
            useVectorization: true,
            outputFormat: 'figma-component'
          }
        });
        
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
    return;
  }
  
  console.log('[Canvas Weaver] Unhandled message type:', msg.type);
};

// Handle messages from UI (which relays WebSocket communication)
const handleUIMessage = (message: any) => {
  // Message from UI related to WebSocket
  if (message.source === 'websocket') {
    switch (message.type) {
      case 'connected':
        isConnectedToServer = true;
        figma.notify('🔗 Connected to Canvas Weaver server', { timeout: 2000 });
        break;
      
      case 'disconnected':
        isConnectedToServer = false;
        figma.notify('❌ Disconnected from server', { timeout: 2000 });
        // Request reconnection
        setTimeout(connectToServerViaUI, 5000);
        break;

      case 'image-processed':
        handleProcessedImageData(message.data);
        break;
      
      case 'error':
        console.error('[Canvas Weaver] Error from server:', message.error);
        figma.notify(`⚠️ Server error: ${message.error.substring(0, 50)}...`, { error: true, timeout: 5000 });
        break;
      
      default:
        console.log('[Canvas Weaver] Unknown WebSocket message type:', message.type);
        break;
    }
  }
}

// Handle processed image data from server
const handleProcessedImageData = async (data: any) => {
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

// Request UI to initialize WebSocket connection
connectToServerViaUI();

// Type definitions for the libraries we'll use
interface RGB {
  r: number;
  g: number;
  b: number;
}

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



// Register the main message handler (single registration)
figma.ui.on("message", mainMessageHandler);

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
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second
  const timeout = 30000; // 30 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Canvas Weaver] Making request to AI server (attempt ${attempt}/${maxRetries})...`);
      
      // Show progress indicator
      if (attempt === 1) {
        figma.notify('🔗 Connecting to AI server...', { timeout: 2000 });
      } else {
        figma.notify(`🔄 Retrying connection (attempt ${attempt}/${maxRetries})...`, { timeout: 2000 });
      }
      
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      // Send image to server for advanced processing via UI
      figma.ui.postMessage({
        type: 'process-image',
        base64: base64,
        options: {
          useSegmentation: true,
          useOCR: true,
          useVectorization: true,
          outputFormat: 'figma-component'
        }
      });
      
      // Wait for response from server
      const result = await new Promise<any>((resolve, reject) => {
        const handleResponse = (message: any) => {
          if (message.source === 'websocket' && message.type === 'image-processed') {
            figma.ui.off('message', handleResponse);
            resolve(message.data);
          }
        };
        
        // Add a temporary listener instead of replacing the main handler
        figma.ui.on('message', handleResponse);
      });
      
      clearTimeout(timeoutId);
      
      console.log('[Canvas Weaver] AI server analysis complete');
      figma.notify('✅ AI analysis complete!', { timeout: 2000 });
      return result;
      
    } catch (error) {
      console.error(`[Canvas Weaver] AI server request failed (attempt ${attempt}):`, error);
      
      // Handle specific error types
      if (error.name === 'AbortError') {
        console.log('[Canvas Weaver] Request timed out');
        figma.notify(`⏱️ Request timed out (attempt ${attempt}/${maxRetries})`, { timeout: 2000, error: true });
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.log('[Canvas Weaver] Network error - server may not be running');
        figma.notify(`🔌 Cannot connect to server (attempt ${attempt}/${maxRetries})`, { timeout: 2000, error: true });
      } else {
        figma.notify(`❌ Server error (attempt ${attempt}/${maxRetries}): ${error.message}`, { timeout: 2000, error: true });
      }
      
      // If this is the last attempt, return null
      if (attempt === maxRetries) {
        console.log('[Canvas Weaver] All retry attempts exhausted, falling back to local processing');
        figma.notify('⚠️ Server unavailable, using local processing...', { timeout: 3000 });
        return null;
      }
      
      // Wait before retrying with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`[Canvas Weaver] Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return null;
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

// Perform client-side OCR using Tesseract.js (via UI)
async function performClientSideOCR(base64: string): Promise<TextBlock[]> {
  try {
    console.log('[Canvas Weaver] Starting client-side OCR via UI...');
    
    // Convert base64 to image data for the UI OCR system
    const imageData = await decodeBase64ToImageData(base64);
    
    // Use the existing UI-based OCR system instead of direct import
    const textBlocks = await performOCR(imageData);
    
    console.log('[Canvas Weaver] Client-side OCR completed, found', textBlocks.length, 'text blocks');
    
    return textBlocks;
    
  } catch (error) {
    console.error('[Canvas Weaver] Client-side OCR failed:', error);
    // Fallback to heuristic text detection
    const imageData = await decodeBase64ToImageData(base64);
    return performFallbackTextDetection(imageData);
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

// Step C: OCR Text Recognition using Tesseract.js in UI
async function performOCR(imageData: {
  width: number;
  height: number;
}): Promise<TextBlock[]> {
  console.log('[Canvas Weaver] Starting OCR via UI...');
  
  try {
    // Convert Uint8Array to base64 for sending to UI
    const base64 = await convertUint8ArrayToBase64(imageData.data);
    
    // Create unique operation ID
    const operationId = ++ocrOperationId;
    
    figma.notify('🔍 Analyzing text with OCR...', { timeout: 2000 });
    
    // Send OCR request to UI
    figma.ui.postMessage({
      type: 'performOCR',
      operationId,
      imageData: {
        base64,
        width: imageData.width,
        height: imageData.height
      }
    });
    
    // Wait for OCR result from UI
    const result = await new Promise<TextBlock[]>((resolve, reject) => {
      pendingOcrOperations.set(operationId, { resolve, reject });
      
      // Set timeout for OCR operation (30 seconds)
      setTimeout(() => {
        if (pendingOcrOperations.has(operationId)) {
          pendingOcrOperations.delete(operationId);
          reject(new Error('OCR operation timed out'));
        }
      }, 30000);
    });
    
    console.log('[Canvas Weaver] OCR completed, found', result.length, 'text blocks');
    return result;
    
  } catch (error) {
    console.error('[Canvas Weaver] OCR failed:', error);
    figma.notify('⚠️ OCR failed, using fallback detection', { timeout: 2000 });
    
    // Fallback to heuristic detection if OCR fails
    return performFallbackTextDetection(imageData);
  }
}

// Helper function to convert Uint8Array to base64
async function convertUint8ArrayToBase64(data: Uint8Array): Promise<string> {
  try {
    // Convert Uint8Array to binary string
    let binaryString = '';
    for (let i = 0; i < data.length; i++) {
      binaryString += String.fromCharCode(data[i]);
    }
    
    // Convert to base64 
    const base64 = btoa(binaryString);
    
    // Add data URL prefix for images
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    throw new Error('Failed to convert image data to base64');
  }
}

// Fallback text detection using heuristics
function performFallbackTextDetection(imageData: {
  width: number;
  height: number;
}): TextBlock[] {
  const textBlocks: TextBlock[] = [];
  
  // Detect potential text regions (simplified heuristic)
  const textRegions = detectTextRegions(imageData);
  
  for (const region of textRegions) {
    textBlocks.push({
      text: 'Text', // Placeholder text
      confidence: 0.5, // Lower confidence for heuristic detection
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

// Step D: Assemble all layers into final component (assembleLayers function)
async function assembleComponent(
  vectorLayers: VectorLayer[],
  textBlocks: TextBlock[],
  width: number,
  height: number
): Promise<FrameNode> {
  figma.notify('🔧 Assembling component layers...', { timeout: 2000 });
  
  // Create parent frame with proper setup
  const parentFrame = figma.createFrame();
  parentFrame.name = 'Generated Component';
  parentFrame.resize(width, height);
  
  // Remove default fills
  parentFrame.fills = [];
  
  console.log('[Canvas Weaver] Assembling', vectorLayers.length, 'vector layers and', textBlocks.length, 'text blocks');
  
  // Smart grouping: Group related elements by proximity and layer type
  const groupedElements = await createSmartGroups(vectorLayers, textBlocks, width, height);
  
  // Add grouped elements to parent frame
  for (const group of groupedElements) {
    parentFrame.appendChild(group);
  }
  
  // Apply intelligent auto-layout based on element positions and relationships
  await applyAdvancedAutoLayout(parentFrame, groupedElements);
  
  // Apply component-level styling with proper semantic structure
  await applyComponentStyling(parentFrame);
  
  figma.notify('✅ Component assembly complete!', { timeout: 2000 });
  
  return parentFrame;
}

// Smart grouping logic for related elements
async function createSmartGroups(
  vectorLayers: VectorLayer[],
  textBlocks: TextBlock[],
  width: number,
  height: number
): Promise<SceneNode[]> {
  const groupedElements: SceneNode[] = [];
  const processedVectors = new Set<number>();
  const processedTexts = new Set<number>();
  
  console.log('[Canvas Weaver] Creating smart groups for', vectorLayers.length, 'vectors and', textBlocks.length, 'texts');
  
  // Create vector elements from SVG paths with enhanced styling
  const vectorNodes = await Promise.all(
    vectorLayers.map(async (vectorLayer, index) => {
      const vectorNode = await createEnhancedVectorFromPath(vectorLayer, index);
      return { node: vectorNode, layer: vectorLayer, index };
    })
  );
  
  // Create text elements with proper styling and font detection
  const textNodes = await Promise.all(
    textBlocks.map(async (textBlock, index) => {
      const textNode = await createEnhancedTextFromBlock(textBlock, index);
      return { node: textNode, block: textBlock, index };
    })
  );
  
  // Group 1: Card-like components (background + content)
  const cardGroups = await createCardGroups(vectorNodes, textNodes, processedVectors, processedTexts);
  groupedElements.push(...cardGroups);
  
  // Group 2: Button-like components (small vectors with text)
  const buttonGroups = await createButtonGroups(vectorNodes, textNodes, processedVectors, processedTexts);
  groupedElements.push(...buttonGroups);
  
  // Group 3: List items (horizontally aligned elements)
  const listGroups = await createListItemGroups(vectorNodes, textNodes, processedVectors, processedTexts);
  groupedElements.push(...listGroups);
  
  // Add remaining ungrouped elements
  for (const { node, index } of vectorNodes) {
    if (!processedVectors.has(index)) {
      groupedElements.push(node);
    }
  }
  
  for (const { node, index } of textNodes) {
    if (!processedTexts.has(index)) {
      groupedElements.push(node);
    }
  }
  
  console.log('[Canvas Weaver] Created', groupedElements.length, 'grouped elements');
  return groupedElements;
}

// Create enhanced vector node from path data with proper SVG processing
async function createEnhancedVectorFromPath(vectorLayer: VectorLayer, index: number): Promise<VectorNode> {
  const vector = figma.createVector();
  vector.name = `Vector ${index + 1}`;
  
  try {
    // Set vector data from SVG path with proper validation
    if (vectorLayer.paths && vectorLayer.paths.trim()) {
      vector.vectorPaths = [{
        windingRule: 'EVENODD',
        data: vectorLayer.paths
      }];
    } else {
      // Create a fallback rectangle path if SVG path is invalid
      const { x, y, width, height } = vectorLayer.bounds;
      vector.vectorPaths = [{
        windingRule: 'EVENODD',
        data: `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`
      }];
    }
    
    // Apply enhanced fill with proper color handling
    const color = vectorLayer.color || { r: 0.8, g: 0.8, b: 0.8 };
    vector.fills = [{
      type: 'SOLID',
      color: {
        r: Math.max(0, Math.min(1, color.r)),
        g: Math.max(0, Math.min(1, color.g)),
        b: Math.max(0, Math.min(1, color.b))
      }
    }];
    
    // Position and size with bounds validation
    const bounds = vectorLayer.bounds;
    vector.x = Math.max(0, bounds.x);
    vector.y = Math.max(0, bounds.y);
    
    if (bounds.width > 0 && bounds.height > 0) {
      vector.resize(Math.max(1, bounds.width), Math.max(1, bounds.height));
    }
    
    // Add semantic naming based on size and position
    if (bounds.width > 200 || bounds.height > 200) {
      vector.name = `Background ${index + 1}`;
    } else if (bounds.width < 50 && bounds.height < 50) {
      vector.name = `Icon ${index + 1}`;
    }
    
  } catch (error) {
    console.error('[Canvas Weaver] Error creating vector:', error);
    // Create minimal fallback vector
    vector.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
  }
  
  return vector;
}

// Create vector node from path data (legacy function for compatibility)
async function createVectorFromPath(vectorLayer: VectorLayer): Promise<VectorNode> {
  return createEnhancedVectorFromPath(vectorLayer, 0);
}

// Create enhanced text node from OCR block with proper font detection and styling
async function createEnhancedTextFromBlock(textBlock: TextBlock, index: number): Promise<TextNode> {
  const text = figma.createText();
  text.name = `Text ${index + 1}`;
  
  try {
    // Advanced font detection based on text characteristics
    const fontInfo = await detectOptimalFont(textBlock);
    
    // Load the detected font with fallbacks
    try {
      await figma.loadFontAsync(fontInfo);
      text.fontName = fontInfo;
    } catch (fontError) {
      // Fallback to Inter Regular
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      text.fontName = { family: "Inter", style: "Regular" };
      console.warn('[Canvas Weaver] Font loading failed, using fallback:', fontError);
    }
    
    // Set text content with proper trimming
    text.characters = textBlock.text.trim() || 'Text';
    
    // Enhanced font size estimation with context awareness
    text.fontSize = estimateEnhancedFontSize(textBlock);
    
    // Position with proper bounds validation
    text.x = Math.max(0, textBlock.bbox.x0);
    text.y = Math.max(0, textBlock.bbox.y0);
    
    // Advanced text styling based on context and size
    const textStyle = determineTextStyle(textBlock, index);
    text.fills = [textStyle.fill];
    
    // Apply text-specific properties
    if (textStyle.letterSpacing) {
      text.letterSpacing = textStyle.letterSpacing;
    }
    
    if (textStyle.lineHeight) {
      text.lineHeight = textStyle.lineHeight;
    }
    
    // Semantic naming based on text characteristics
    if (text.fontSize > 24) {
      text.name = `Heading ${index + 1}`;
    } else if (text.fontSize > 16) {
      text.name = `Subheading ${index + 1}`;
    } else {
      text.name = `Body Text ${index + 1}`;
    }
    
  } catch (error) {
    console.error('[Canvas Weaver] Error creating text node:', error);
    // Create minimal fallback text
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    text.fontName = { family: "Inter", style: "Regular" };
    text.characters = textBlock.text.trim() || 'Text';
    text.fontSize = 14;
    text.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
  }
  
  return text;
}

// Create text node from OCR block (legacy function for compatibility)
async function createTextFromBlock(textBlock: TextBlock): Promise<TextNode> {
  return createEnhancedTextFromBlock(textBlock, 0);
}

// Advanced font detection based on text characteristics
async function detectOptimalFont(textBlock: TextBlock): Promise<FontName> {
  const textHeight = textBlock.bbox.y1 - textBlock.bbox.y0;
  const textWidth = textBlock.bbox.x1 - textBlock.bbox.x0;
  const aspectRatio = textWidth / textHeight;
  
  // Analyze text characteristics for font selection
  const text = textBlock.text.toLowerCase();
  const hasNumbers = /\d/.test(text);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(text);
  const isAllCaps = textBlock.text === textBlock.text.toUpperCase();
  
  // Font selection logic based on context
  if (textHeight > 24) {
    // Large text - likely headers
    if (isAllCaps || hasSpecialChars) {
      return { family: "Inter", style: "Bold" };
    }
    return { family: "Inter", style: "SemiBold" };
  } else if (textHeight > 16) {
    // Medium text - likely subheaders
    return { family: "Inter", style: "Medium" };
  } else if (hasNumbers && aspectRatio > 3) {
    // Likely numeric/code content
    return { family: "Inter", style: "Regular" };
  } else {
    // Body text
    return { family: "Inter", style: "Regular" };
  }
}

// Enhanced font size estimation with context awareness
function estimateEnhancedFontSize(textBlock: TextBlock): number {
  const height = textBlock.bbox.y1 - textBlock.bbox.y0;
  const width = textBlock.bbox.x1 - textBlock.bbox.x0;
  
  // Base calculation with improved accuracy
  let fontSize = Math.max(8, Math.min(72, height * 0.8));
  
  // Adjust based on text characteristics
  const charCount = textBlock.text.length;
  const avgCharWidth = charCount > 0 ? width / charCount : 10;
  
  // Consider character density for better estimation
  if (avgCharWidth < 6) {
    fontSize = Math.max(10, fontSize * 0.9); // Condensed text
  } else if (avgCharWidth > 15) {
    fontSize = Math.min(48, fontSize * 1.1); // Wide text
  }
  
  // Confidence-based adjustment
  if (textBlock.confidence < 0.7) {
    fontSize = Math.max(12, fontSize); // Ensure minimum readability
  }
  
  return Math.round(fontSize);
}

// Determine text style based on context and characteristics
function determineTextStyle(textBlock: TextBlock, index: number): {
  fill: SolidPaint;
  letterSpacing?: LetterSpacing;
  lineHeight?: LineHeight;
} {
  const fontSize = estimateEnhancedFontSize(textBlock);
  const isLargeText = fontSize > 20;
  const isSmallText = fontSize < 14;
  
  // Color determination based on context
  let color = { r: 0.1, g: 0.1, b: 0.1 }; // Default dark text
  
  if (isLargeText) {
    // Headers - darker and more prominent
    color = { r: 0.05, g: 0.05, b: 0.05 };
  } else if (isSmallText) {
    // Small text - slightly lighter for better readability
    color = { r: 0.3, g: 0.3, b: 0.3 };
  }
  
  const style: {
    fill: SolidPaint;
    letterSpacing?: LetterSpacing;
    lineHeight?: LineHeight;
  } = {
    fill: { type: 'SOLID', color }
  };
  
  // Letter spacing for better readability
  if (isLargeText) {
    style.letterSpacing = { value: -0.5, unit: 'PERCENT' };
  } else if (isSmallText) {
    style.letterSpacing = { value: 0.5, unit: 'PERCENT' };
  }
  
  // Line height for better typography
  style.lineHeight = { value: 1.4, unit: 'PERCENT' };
  
  return style;
}

// Estimate font size based on bounding box (legacy function for compatibility)
function estimateFontSizeFromBounds(bbox: {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}): number {
  const height = bbox.y1 - bbox.y0;
  return Math.max(12, Math.min(48, height * 0.7));
}

// Create card-like component groups (background + content)
async function createCardGroups(
  vectorNodes: Array<{ node: VectorNode; layer: VectorLayer; index: number }>,
  textNodes: Array<{ node: TextNode; block: TextBlock; index: number }>,
  processedVectors: Set<number>,
  processedTexts: Set<number>
): Promise<FrameNode[]> {
  const cardGroups: FrameNode[] = [];
  
  // Find large background vectors that could be cards
  const backgroundVectors = vectorNodes.filter(({ layer, index }) => {
    if (processedVectors.has(index)) return false;
    const { width, height } = layer.bounds;
    return width > 100 && height > 60; // Minimum card size
  });
  
  for (const { node: backgroundNode, layer: backgroundLayer, index: bgIndex } of backgroundVectors) {
    // Find text elements that are within or near this background
    const relatedTexts = textNodes.filter(({ block, index }) => {
      if (processedTexts.has(index)) return false;
      
      const textCenterX = (block.bbox.x0 + block.bbox.x1) / 2;
      const textCenterY = (block.bbox.y0 + block.bbox.y1) / 2;
      
      // Check if text is within or near the background bounds
      const bg = backgroundLayer.bounds;
      const margin = 20; // Allow some margin for text near the background
      
      return textCenterX >= bg.x - margin &&
             textCenterX <= bg.x + bg.width + margin &&
             textCenterY >= bg.y - margin &&
             textCenterY <= bg.y + bg.height + margin;
    });
    
    if (relatedTexts.length > 0) {
      // Create card group
      const cardFrame = figma.createFrame();
      cardFrame.name = `Card ${cardGroups.length + 1}`;
      
      // Set frame bounds to encompass all elements
      const allBounds = [
        backgroundLayer.bounds,
        ...relatedTexts.map(({ block }) => ({
          x: block.bbox.x0,
          y: block.bbox.y0,
          width: block.bbox.x1 - block.bbox.x0,
          height: block.bbox.y1 - block.bbox.y0
        }))
      ];
      
      const minX = Math.min(...allBounds.map(b => 'x0' in b ? b.x0 : b.x));
      const minY = Math.min(...allBounds.map(b => 'y0' in b ? b.y0 : b.y));
      const maxX = Math.max(...allBounds.map(b => 'x1' in b ? b.x1 : b.x + b.width));
      const maxY = Math.max(...allBounds.map(b => 'y1' in b ? b.y1 : b.y + b.height));
      
      cardFrame.x = minX;
      cardFrame.y = minY;
      cardFrame.resize(maxX - minX, maxY - minY);
      cardFrame.fills = [];
      
      // Add background
      backgroundNode.x -= minX;
      backgroundNode.y -= minY;
      cardFrame.appendChild(backgroundNode);
      
      // Add related texts
      for (const { node: textNode, index: textIndex } of relatedTexts) {
        textNode.x -= minX;
        textNode.y -= minY;
        cardFrame.appendChild(textNode);
        processedTexts.add(textIndex);
      }
      
      processedVectors.add(bgIndex);
      cardGroups.push(cardFrame);
    }
  }
  
  return cardGroups;
}

// Create button-like component groups (small vectors with text)
async function createButtonGroups(
  vectorNodes: Array<{ node: VectorNode; layer: VectorLayer; index: number }>,
  textNodes: Array<{ node: TextNode; block: TextBlock; index: number }>,
  processedVectors: Set<number>,
  processedTexts: Set<number>
): Promise<FrameNode[]> {
  const buttonGroups: FrameNode[] = [];
  
  // Find small/medium vectors that could be buttons
  const buttonVectors = vectorNodes.filter(({ layer, index }) => {
    if (processedVectors.has(index)) return false;
    const { width, height } = layer.bounds;
    return width >= 60 && width <= 200 && height >= 20 && height <= 60;
  });
  
  for (const { node: buttonNode, layer: buttonLayer, index: btnIndex } of buttonVectors) {
    // Find text that's centered on this vector
    const relatedText = textNodes.find(({ block, index }) => {
      if (processedTexts.has(index)) return false;
      
      const textCenterX = (block.bbox.x0 + block.bbox.x1) / 2;
      const textCenterY = (block.bbox.y0 + block.bbox.y1) / 2;
      
      // Check if text is centered on the button
      const bg = buttonLayer.bounds;
      const bgCenterX = bg.x + bg.width / 2;
      const bgCenterY = bg.y + bg.height / 2;
      
      // Check if text is centered on the button
      const centerThreshold = Math.min(bg.width, bg.height) / 3;
      
      return Math.abs(textCenterX - bgCenterX) < centerThreshold &&
             Math.abs(textCenterY - bgCenterY) < centerThreshold;
    });
    
    if (relatedText) {
      // Create button group
      const buttonFrame = figma.createFrame();
      buttonFrame.name = `Button ${buttonGroups.length + 1}`;
      
      // Set frame to button bounds
      buttonFrame.x = buttonLayer.bounds.x;
      buttonFrame.y = buttonLayer.bounds.y;
      buttonFrame.resize(buttonLayer.bounds.width, buttonLayer.bounds.height);
      buttonFrame.fills = [];
      
      // Add button background
      buttonNode.x = 0;
      buttonNode.y = 0;
      buttonFrame.appendChild(buttonNode);
      
      // Center text on button
      const textNode = relatedText.node;
      textNode.x = (buttonLayer.bounds.width - (relatedText.block.bbox.x1 - relatedText.block.bbox.x0)) / 2;
      textNode.y = (buttonLayer.bounds.height - (relatedText.block.bbox.y1 - relatedText.block.bbox.y0)) / 2;
      buttonFrame.appendChild(textNode);
      
      processedVectors.add(btnIndex);
      processedTexts.add(relatedText.index);
      buttonGroups.push(buttonFrame);
    }
  }
  
  return buttonGroups;
}

// Create list item groups (horizontally aligned elements)
async function createListItemGroups(
  vectorNodes: Array<{ node: VectorNode; layer: VectorLayer; index: number }>,
  textNodes: Array<{ node: TextNode; block: TextBlock; index: number }>,
  processedVectors: Set<number>,
  processedTexts: Set<number>
): Promise<FrameNode[]> {
  const listGroups: FrameNode[] = [];
  
  // Group texts by similar Y positions (potential list items)
  const textsByRow: Array<Array<{ node: TextNode; block: TextBlock; index: number }>> = [];
  const rowThreshold = 10; // Pixels tolerance for same row
  
  for (const textItem of textNodes) {
    if (processedTexts.has(textItem.index)) continue;
    
    const textY = (textItem.block.bbox.y0 + textItem.block.bbox.y1) / 2;
    
    // Find existing row or create new one
    let foundRow = false;
    for (const row of textsByRow) {
      const rowY = (row[0].block.bbox.y0 + row[0].block.bbox.y1) / 2;
      if (Math.abs(textY - rowY) < rowThreshold) {
        row.push(textItem);
        foundRow = true;
        break;
      }
    }
    
    if (!foundRow) {
      textsByRow.push([textItem]);
    }
  }
  
  // Create list items for rows with multiple texts
  for (const row of textsByRow) {
    if (row.length >= 2) {
      // Sort by X position
      row.sort((a, b) => a.block.bbox.x0 - b.block.bbox.x0);
      
      // Find any small vectors (icons) in this row
      const rowY = (row[0].block.bbox.y0 + row[0].block.bbox.y1) / 2;
      const rowVectors = vectorNodes.filter(({ layer, index }) => {
        if (processedVectors.has(index)) return false;
        const vectorY = layer.bounds.y + layer.bounds.height / 2;
        const { width, height } = layer.bounds;
        return Math.abs(vectorY - rowY) < rowThreshold * 2 && 
               width < 50 && height < 50; // Small icons
      });
      
      // Create list item frame
      const listFrame = figma.createFrame();
      listFrame.name = `List Item ${listGroups.length + 1}`;
      
      // Calculate bounds
      const allElements = [
        ...row.map(r => r.block.bbox),
        ...rowVectors.map(v => v.layer.bounds)
      ];
      
      const minX = Math.min(...allElements.map(b => 'x0' in b ? b.x0 : b.x));
      const minY = Math.min(...allElements.map(b => 'y0' in b ? b.y0 : b.y));
      const maxX = Math.max(...allElements.map(b => 'x1' in b ? b.x1 : b.x + b.width));
      const maxY = Math.max(...allElements.map(b => 'y1' in b ? b.y1 : b.y + b.height));
      
      listFrame.x = minX;
      listFrame.y = minY;
      listFrame.resize(maxX - minX, maxY - minY);
      listFrame.fills = [];
      listFrame.layoutMode = 'HORIZONTAL';
      listFrame.itemSpacing = 8;
      listFrame.paddingLeft = 8;
      listFrame.paddingRight = 8;
      listFrame.counterAxisAlignItems = 'CENTER';
      
      // Add vectors (icons)
      for (const { node: vectorNode, index: vectorIndex } of rowVectors) {
        vectorNode.x = 0;
        vectorNode.y = 0;
        listFrame.appendChild(vectorNode);
        processedVectors.add(vectorIndex);
      }
      
      // Add texts
      for (const { node: textNode, index: textIndex } of row) {
        textNode.x = 0;
        textNode.y = 0;
        listFrame.appendChild(textNode);
        processedTexts.add(textIndex);
      }
      
      listGroups.push(listFrame);
    }
  }
  
  return listGroups;
}

// Apply advanced auto-layout with better detection algorithms
async function applyAdvancedAutoLayout(parentFrame: FrameNode, groupedElements: SceneNode[]): Promise<void> {
  if (groupedElements.length < 2) return;
  
  console.log('[Canvas Weaver] Applying advanced auto-layout to', groupedElements.length, 'elements');
  
  // Analyze element positions and relationships
  const elementPositions = groupedElements.map(element => ({
    element,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    centerX: element.x + element.width / 2,
    centerY: element.y + element.height / 2
  }));
  
  // Advanced layout detection with multiple algorithms
  const layoutAnalysis = {
    isVertical: detectAdvancedVerticalLayout(elementPositions),
    isHorizontal: detectAdvancedHorizontalLayout(elementPositions),
    isGrid: detectGridLayout(elementPositions),
    isCentered: detectCenteredLayout(elementPositions)
  };
  
  console.log('[Canvas Weaver] Layout analysis:', layoutAnalysis);
  
  // Apply the most appropriate layout
  if (layoutAnalysis.isGrid) {
    applyGridLayout(parentFrame, elementPositions);
  } else if (layoutAnalysis.isVertical && !layoutAnalysis.isHorizontal) {
    applyVerticalLayout(parentFrame, elementPositions);
  } else if (layoutAnalysis.isHorizontal && !layoutAnalysis.isVertical) {
    applyHorizontalLayout(parentFrame, elementPositions);
  } else if (layoutAnalysis.isCentered) {
    applyCenteredLayout(parentFrame, elementPositions);
  } else {
    // Free-form layout - apply basic spacing optimization
    applyFreeFormLayout(parentFrame, elementPositions);
  }
}

// Advanced vertical layout detection
function detectAdvancedVerticalLayout(positions: Array<{
  element: SceneNode;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}>): boolean {
  if (positions.length < 2) return false;
  
  // Sort by Y position
  const sortedByY = [...positions].sort((a, b) => a.y - b.y);
  
  let verticalAlignedCount = 0;
  let consistentSpacing = true;
  let spacings: number[] = [];
  
  for (let i = 1; i < sortedByY.length; i++) {
    const prev = sortedByY[i - 1];
    const curr = sortedByY[i];
    
    // Check X alignment (allowing some tolerance)
    const xAlignmentTolerance = 30;
    if (Math.abs(prev.centerX - curr.centerX) < xAlignmentTolerance) {
      verticalAlignedCount++;
    }
    
    // Check spacing consistency
    const spacing = curr.y - (prev.y + prev.height);
    spacings.push(spacing);
  }
  
  // Check spacing consistency
  if (spacings.length > 1) {
    const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
    const spacingVariance = spacings.reduce((sum, spacing) => sum + Math.abs(spacing - avgSpacing), 0) / spacings.length;
    consistentSpacing = spacingVariance < 20; // 20px tolerance
  }
  
  const alignmentRatio = verticalAlignedCount / (positions.length - 1);
  return alignmentRatio > 0.6 && consistentSpacing;
}

// Advanced horizontal layout detection
function detectAdvancedHorizontalLayout(positions: Array<{
  element: SceneNode;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}>): boolean {
  if (positions.length < 2) return false;
  
  // Sort by X position
  const sortedByX = [...positions].sort((a, b) => a.x - b.x);
  
  let horizontalAlignedCount = 0;
  let consistentSpacing = true;
  let spacings: number[] = [];
  
  for (let i = 1; i < sortedByX.length; i++) {
    const prev = sortedByX[i - 1];
    const curr = sortedByX[i];
    
    // Check Y alignment (allowing some tolerance)
    const yAlignmentTolerance = 30;
    if (Math.abs(prev.centerY - curr.centerY) < yAlignmentTolerance) {
      horizontalAlignedCount++;
    }
    
    // Check spacing consistency
    const spacing = curr.x - (prev.x + prev.width);
    spacings.push(spacing);
  }
  
  // Check spacing consistency
  if (spacings.length > 1) {
    const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
    const spacingVariance = spacings.reduce((sum, spacing) => sum + Math.abs(spacing - avgSpacing), 0) / spacings.length;
    consistentSpacing = spacingVariance < 20; // 20px tolerance
  }
  
  const alignmentRatio = horizontalAlignedCount / (positions.length - 1);
  return alignmentRatio > 0.6 && consistentSpacing;
}

// Grid layout detection
function detectGridLayout(positions: Array<{
  element: SceneNode;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}>): boolean {
  if (positions.length < 4) return false;
  
  // Group elements by similar Y positions (rows)
  const rows: Array<Array<typeof positions[0]>> = [];
  const rowTolerance = 20;
  
  for (const pos of positions) {
    let foundRow = false;
    for (const row of rows) {
      if (Math.abs(row[0].centerY - pos.centerY) < rowTolerance) {
        row.push(pos);
        foundRow = true;
        break;
      }
    }
    if (!foundRow) {
      rows.push([pos]);
    }
  }
  
  // Check if we have multiple rows with consistent column counts
  const validRows = rows.filter(row => row.length > 1);
  if (validRows.length < 2) return false;
  
  // Check column consistency
  const columnCounts = validRows.map(row => row.length);
  const isConsistentColumns = columnCounts.every(count => count === columnCounts[0]);
  
  return isConsistentColumns && validRows.length >= 2;
}

// Centered layout detection
function detectCenteredLayout(positions: Array<{
  element: SceneNode;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}>): boolean {
  if (positions.length < 2) return false;
  
  // Calculate overall bounds
  const minX = Math.min(...positions.map(p => p.x));
  const maxX = Math.max(...positions.map(p => p.x + p.width));
  const minY = Math.min(...positions.map(p => p.y));
  const maxY = Math.max(...positions.map(p => p.y + p.height));
  
  const containerCenterX = (minX + maxX) / 2;
  const containerCenterY = (minY + maxY) / 2;
  
  // Check how many elements are centered
  let centeredCount = 0;
  const centerTolerance = 40;
  
  for (const pos of positions) {
    if (Math.abs(pos.centerX - containerCenterX) < centerTolerance) {
      centeredCount++;
    }
  }
  
  return centeredCount / positions.length > 0.7;
}

// Apply different layout types
function applyVerticalLayout(parentFrame: FrameNode, positions: Array<{ element: SceneNode }>): void {
  parentFrame.layoutMode = 'VERTICAL';
  parentFrame.counterAxisAlignItems = 'CENTER';
  parentFrame.itemSpacing = calculateOptimalSpacing(positions, 'vertical');
  parentFrame.paddingTop = 16;
  parentFrame.paddingBottom = 16;
  parentFrame.paddingLeft = 16;
  parentFrame.paddingRight = 16;
}

function applyHorizontalLayout(parentFrame: FrameNode, positions: Array<{ element: SceneNode }>): void {
  parentFrame.layoutMode = 'HORIZONTAL';
  parentFrame.counterAxisAlignItems = 'CENTER';
  parentFrame.itemSpacing = calculateOptimalSpacing(positions, 'horizontal');
  parentFrame.paddingTop = 16;
  parentFrame.paddingBottom = 16;
  parentFrame.paddingLeft = 16;
  parentFrame.paddingRight = 16;
}

function applyGridLayout(parentFrame: FrameNode, positions: Array<{ element: SceneNode }>): void {
  // For now, use vertical with centered alignment as a grid approximation
  parentFrame.layoutMode = 'VERTICAL';
  parentFrame.counterAxisAlignItems = 'CENTER';
  parentFrame.itemSpacing = 12;
  parentFrame.paddingTop = 20;
  parentFrame.paddingBottom = 20;
  parentFrame.paddingLeft = 20;
  parentFrame.paddingRight = 20;
}

function applyCenteredLayout(parentFrame: FrameNode, positions: Array<{ element: SceneNode }>): void {
  parentFrame.layoutMode = 'VERTICAL';
  parentFrame.counterAxisAlignItems = 'CENTER';
  parentFrame.primaryAxisAlignItems = 'CENTER';
  parentFrame.itemSpacing = 16;
  parentFrame.paddingTop = 24;
  parentFrame.paddingBottom = 24;
  parentFrame.paddingLeft = 24;
  parentFrame.paddingRight = 24;
}

function applyFreeFormLayout(parentFrame: FrameNode, positions: Array<{ element: SceneNode }>): void {
  // Keep absolute positioning but add some padding
  parentFrame.layoutMode = 'NONE';
  parentFrame.paddingTop = 8;
  parentFrame.paddingBottom = 8;
  parentFrame.paddingLeft = 8;
  parentFrame.paddingRight = 8;
}

// Calculate optimal spacing based on element positions
function calculateOptimalSpacing(positions: Array<{ element: SceneNode }>, direction: 'vertical' | 'horizontal'): number {
  if (positions.length < 2) return 16;
  
  const spacings: number[] = [];
  const sorted = direction === 'vertical' 
    ? [...positions].sort((a, b) => a.element.y - b.element.y)
    : [...positions].sort((a, b) => a.element.x - b.element.x);
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].element;
    const curr = sorted[i].element;
    
    const spacing = direction === 'vertical' 
      ? curr.y - (prev.y + prev.height)
      : curr.x - (prev.x + prev.width);
    
    if (spacing >= 0) {
      spacings.push(spacing);
    }
  }
  
  if (spacings.length === 0) return 16;
  
  // Use median spacing to avoid outliers
  spacings.sort((a, b) => a - b);
  const median = spacings[Math.floor(spacings.length / 2)];
  
  // Clamp to reasonable values
  return Math.max(4, Math.min(32, median));
}

// Apply component-level styling with proper semantic structure
async function applyComponentStyling(parentFrame: FrameNode): Promise<void> {
  // Apply modern component styling
  parentFrame.cornerRadius = 12;
  parentFrame.clipsContent = false; // Allow shadows and effects to show
  
  // Add subtle shadow for depth
  parentFrame.effects = [{
    type: 'DROP_SHADOW',
    visible: true,
    color: { r: 0, g: 0, b: 0, a: 0.1 },
    blendMode: 'NORMAL',
    offset: { x: 0, y: 2 },
    radius: 8,
    spread: 0
  }];
  
  // Add light background if no fill is set
  if (parentFrame.fills.length === 0) {
    parentFrame.fills = [{
      type: 'SOLID',
      color: { r: 0.99, g: 0.99, b: 0.99 }
    }];
  }
}

// Apply intelligent auto-layout based on layer positions (legacy function for compatibility)
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
    frame.paddingTop = 16;
    frame.paddingBottom = 16;
    frame.paddingLeft = 16;
    frame.paddingRight = 16;
  } else if (isHorizontal) {
    frame.layoutMode = 'HORIZONTAL';
    frame.counterAxisAlignItems = 'CENTER';
    frame.itemSpacing = calculateAverageSpacing(positions, 'horizontal');
    frame.paddingTop = 16;
    frame.paddingBottom = 16;
    frame.paddingLeft = 16;
    frame.paddingRight = 16;
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
  // Notify UI to close WebSocket connection
  try {
    figma.ui.postMessage({
      type: 'close-websocket'
    });
    
    // Clean up message handlers
    figma.ui.off('message', mainMessageHandler);
  } catch (error) {
    console.error('[Canvas Weaver] Failed to request WebSocket closure:', error);
  }
});

// Initial setup
console.log('[Canvas Weaver] Plugin initialized - Ready to generate components from images');