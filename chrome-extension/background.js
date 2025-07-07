// Background script for Canvas Weaver extension

let websocket = null;
let connectionState = 'disconnected';
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectInterval = 2000;

// WebSocket configuration
const WS_URL = 'ws://localhost:8082';

// Handle installation or update
chrome.runtime.onInstalled.addListener(function() {
  console.log('Canvas Weaver extension installed or updated');
  // Delay initial connection to allow server startup
  setTimeout(() => {
    connectWebSocket();
  }, 2000);
});

// Initialize WebSocket connection on startup
chrome.runtime.onStartup.addListener(function() {
  console.log('Canvas Weaver extension started');
  // Delay initial connection to allow server startup
  setTimeout(() => {
    connectWebSocket();
  }, 2000);
});

// Connect to WebSocket server
function connectWebSocket() {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    return;
  }
  
  // Don't attempt connection if we've exceeded max attempts without manual retry
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.log('Max reconnection attempts reached. Manual retry required.');
    connectionState = 'failed';
    broadcastConnectionStatus();
    return;
  }

  try {
    console.log('Connecting to WebSocket server at', WS_URL);
    websocket = new WebSocket(WS_URL);
    
    websocket.onopen = function(event) {
      console.log('WebSocket connected successfully');
      connectionState = 'connected';
      reconnectAttempts = 0;
      
      // Notify all tabs about connection status
      broadcastConnectionStatus();
    };
    
    websocket.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        // Forward message to appropriate tab/popup
        if (data.type === 'component_processed') {
          forwardToFigmaPlugin(data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    websocket.onclose = function(event) {
      console.log('WebSocket connection closed:', event.code, event.reason);
      connectionState = 'disconnected';
      
      // Attempt to reconnect if not manually closed and not exceeded attempts
      if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
        setTimeout(connectWebSocket, reconnectInterval * reconnectAttempts); // Exponential backoff
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        console.log('Max reconnection attempts reached. Connection failed.');
        connectionState = 'failed';
      }
      
      broadcastConnectionStatus();
    };
    
    websocket.onerror = function(error) {
      console.error('WebSocket error:', error);
      connectionState = 'error';
      broadcastConnectionStatus();
    };
    
  } catch (error) {
    console.error('Failed to create WebSocket connection:', error);
    connectionState = 'error';
    broadcastConnectionStatus();
  }
}

// Send data to WebSocket server
function sendToWebSocket(data) {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    try {
      websocket.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket data:', error);
      return false;
    }
  } else {
    console.warn('WebSocket not connected, cannot send data. State:', 
      websocket ? websocket.readyState : 'no websocket');
    
    // Attempt to reconnect if connection is lost
    if (!websocket || websocket.readyState === WebSocket.CLOSED) {
      console.log('Attempting to reconnect WebSocket...');
      connectWebSocket();
    }
    
    return false;
  }
}

// Broadcast connection status to all tabs and popup
function broadcastConnectionStatus() {
  const status = {
    action: 'websocket_status',
    connected: connectionState === 'connected',
    state: connectionState
  };
  
  // Send to popup
  chrome.runtime.sendMessage(status).catch(() => {
    // Popup might not be open, ignore error
  });
  
  // Send to all tabs
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, status).catch(() => {
        // Tab might not have content script, ignore error
      });
    });
  });
}

// Forward component data to Figma plugin
function forwardToFigmaPlugin(data) {
  // This would typically involve posting to the Figma plugin window
  // For now, we'll store it and let the popup handle it
  chrome.storage.local.set({
    lastComponentData: data,
    timestamp: Date.now()
  });
  
  // Notify popup of new data
  chrome.runtime.sendMessage({
    action: 'component_ready',
    data: data
  }).catch(() => {
    // Popup might not be open, ignore error
  });
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request.action);
  
  switch (request.action) {
    case 'get_connection_status':
      sendResponse({
        connected: connectionState === 'connected',
        state: connectionState
      });
      return true;
      
    case 'send_component_data':
      console.log('Background: Sending component data to WebSocket');
      const success = sendToWebSocket({
        type: 'processImage',
        base64: request.data.imageData,
        metadata: request.data.metadata,
        source: request.data.source,
        options: {
          enableAI: true,
          generateVectors: true,
          performOCR: true
        }
      });
      console.log('Background: WebSocket send result:', success);
      sendResponse({ success });
      return true;
      
    case 'reconnect_websocket':
      // Reset reconnect attempts for manual retry
      reconnectAttempts = 0;
      connectionState = 'connecting';
      connectWebSocket();
      sendResponse({ success: true });
      return true;
      
    case 'keep_alive':
      // Just acknowledge to keep the connection alive
      sendResponse({ success: true });
      return true;
      
    default:
      return false;
  }
});

// Initialize connection when script loads with delay
setTimeout(() => {
  connectWebSocket();
}, 1000);
