// Simple Canvas Weaver Figma Plugin - No Modules
// Show UI
figma.showUI(__html__, { width: 400, height: 600 });

// Server connection status
var isConnectedToServer = false;

// OCR operation tracking
var ocrOperationId = 0;
var pendingOcrOperations = new Map();

// Logger
var Logger = {
  log: function(message) {
    console.log('[Canvas Weaver] ' + message);
  },
  error: function(message, error) {
    console.error('[Canvas Weaver] ERROR: ' + message, error);
  }
};

// Configuration
var config = {
  websocketUrl: 'ws://localhost:8080',
  isDevelopment: true,
  enableLogging: true
};

// Request the UI to establish WebSocket connection
function connectToServerViaUI() {
  try {
    figma.ui.postMessage({
      type: 'connect-to-websocket',
      url: config.websocketUrl
    });
    Logger.log('Requested WebSocket connection via UI');
  } catch (error) {
    Logger.error('Failed to request WebSocket connection', error);
    setTimeout(connectToServerViaUI, 5000);
  }
}

// Main message handler
function mainMessageHandler(msg) {
  Logger.log('Received message: ' + msg.type);
  
  // Handle resize messages
  if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
    return;
  }
  
  // Handle cancel/close
  if (msg.type === 'cancel') {
    figma.closePlugin();
    return;
  }
  
  // Handle messages from UI related to WebSocket communication
  if (msg.source === 'websocket') {
    handleUIMessage(msg);
    return;
  }
  
  // Handle component generation from processed data (auto-scan)
  if (msg.type === 'generateComponentFromProcessedData') {
    try {
      figma.notify('🎨 Creating component from auto-scan...', { timeout: 3000 });
      
      buildComponentFromProcessedData(msg.data).then(function(component) {
        // Add to page and position
        figma.currentPage.appendChild(component);
        var viewportCenter = figma.viewport.center;
        component.x = Math.round(viewportCenter.x - component.width / 2);
        component.y = Math.round(viewportCenter.y - component.height / 2);
        
        figma.currentPage.selection = [component];
        figma.viewport.scrollAndZoomIntoView([component]);
        
        // Copy to clipboard for easy pasting
        figma.notify('✅ Component ready! You can now paste it anywhere with Cmd+V (Mac) or Ctrl+V (Windows)', { timeout: 6000 });
        
        // Notify UI of completion
        figma.ui.postMessage({
          type: 'auto-scan-complete',
          success: true
        });
      }).catch(function(error) {
        console.error('[Canvas Weaver] Error creating auto-scan component:', error);
        var errorMessage = error.message || 'Unknown error';
        figma.notify('❌ Auto-scan failed: ' + errorMessage, { timeout: 5000, error: true });
        
        figma.ui.postMessage({
          type: 'auto-scan-complete',
          success: false,
          error: errorMessage
        });
      });
    } catch (error) {
      console.error('[Canvas Weaver] Error in auto-scan handler:', error);
      figma.notify('❌ Auto-scan failed: ' + error.message, { timeout: 5000, error: true });
    }
    return;
  }
  
  console.log('[Canvas Weaver] Unhandled message type: ' + msg.type);
}

// Handle messages from UI
function handleUIMessage(message) {
  if (message.source === 'websocket') {
    switch (message.type) {
      case 'connected':
        isConnectedToServer = true;
        figma.notify('🔗 Connected to Canvas Weaver server', { timeout: 2000 });
        break;
      
      case 'disconnected':
        isConnectedToServer = false;
        figma.notify('❌ Disconnected from server', { timeout: 2000 });
        setTimeout(connectToServerViaUI, 5000);
        break;

      case 'image-processed':
        handleProcessedImageData(message.data);
        break;
      
      case 'error':
        console.error('[Canvas Weaver] Error from server:', message.error);
        figma.notify('⚠️ Server error: ' + message.error.substring(0, 50) + '...', { error: true, timeout: 5000 });
        break;
      
      default:
        console.log('[Canvas Weaver] Unknown WebSocket message type: ' + message.type);
        break;
    }
  }
}

// Handle processed image data from server
function handleProcessedImageData(data) {
  try {
    figma.notify('🎨 Building component from processed data...', { timeout: 3000 });
    
    buildComponentFromProcessedData(data).then(function(component) {
      // Add to page and position
      figma.currentPage.appendChild(component);
      var viewportCenter = figma.viewport.center;
      component.x = Math.round(viewportCenter.x - component.width / 2);
      component.y = Math.round(viewportCenter.y - component.height / 2);
      
      figma.currentPage.selection = [component];
      figma.viewport.scrollAndZoomIntoView([component]);
      
      figma.notify('✅ Component created from advanced processing!', { timeout: 4000 });
    }).catch(function(error) {
      console.error('[Canvas Weaver] Error building component:', error);
      var errorMessage = error.message || 'Unknown error';
      figma.notify('❌ Component creation failed: ' + errorMessage, { timeout: 5000, error: true });
    });
  } catch (error) {
    console.error('[Canvas Weaver] Error in handleProcessedImageData:', error);
  }
}

// Build component from processed data
function buildComponentFromProcessedData(data) {
  return new Promise(function(resolve, reject) {
    try {
      console.log('[Canvas Weaver] Building component from processed data');
      
      var frame = figma.createFrame();
      frame.name = 'AI Generated Component';
      frame.resize(data.width || 400, data.height || 300);
      frame.fills = [];
      
      // Add shapes if available
      if (data.shapes && data.shapes.length > 0) {
        for (var i = 0; i < data.shapes.length; i++) {
          var shape = data.shapes[i];
          var shapeNode = createShapeFromData(shape);
          shapeNode.name = 'Shape ' + (i + 1);
          frame.appendChild(shapeNode);
        }
      }
      
      // Add text if available
      if (data.textBlocks && data.textBlocks.length > 0) {
        for (var i = 0; i < data.textBlocks.length; i++) {
          var textBlock = data.textBlocks[i];
          var textNode = createTextFromData(textBlock);
          textNode.name = 'Text ' + (i + 1);
          frame.appendChild(textNode);
        }
      }
      
      // Add vectors if available
      if (data.vectors && data.vectors.length > 0) {
        for (var i = 0; i < data.vectors.length; i++) {
          var vector = data.vectors[i];
          var vectorNode = createVectorFromData(vector);
          vectorNode.name = 'Vector ' + (i + 1);
          frame.appendChild(vectorNode);
        }
      }
      
      resolve(frame);
    } catch (error) {
      reject(error);
    }
  });
}

// Create shape from data
function createShapeFromData(shapeData) {
  var rect = figma.createRectangle();
  rect.resize(shapeData.width || 100, shapeData.height || 50);
  rect.x = shapeData.x || 0;
  rect.y = shapeData.y || 0;
  
  if (shapeData.fill) {
    rect.fills = [{
      type: 'SOLID',
      color: shapeData.fill
    }];
  }
  
  return rect;
}

// Create text from data
function createTextFromData(textData) {
  var text = figma.createText();
  
  // Load font
  figma.loadFontAsync({ family: 'Inter', style: 'Regular' }).then(function() {
    text.fontName = { family: 'Inter', style: 'Regular' };
    text.characters = textData.text || 'Generated Text';
    text.fontSize = textData.fontSize || 16;
    text.x = textData.x || 0;
    text.y = textData.y || 0;
    
    if (textData.color) {
      text.fills = [{
        type: 'SOLID',
        color: textData.color
      }];
    }
  }).catch(function(error) {
    console.warn('[Canvas Weaver] Font loading failed:', error);
  });
  
  return text;
}

// Create vector from data
function createVectorFromData(vectorData) {
  var vector = figma.createVector();
  
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

// Initialize
connectToServerViaUI();
figma.ui.on('message', mainMessageHandler);

// Clean up on close
figma.on('close', function() {
  console.log('[Canvas Weaver] Plugin closed');
  try {
    figma.ui.postMessage({
      type: 'close-websocket'
    });
  } catch (error) {
    console.error('[Canvas Weaver] Failed to request WebSocket closure:', error);
  }
});

console.log('[Canvas Weaver] Plugin initialized - Ready to generate components from images');