class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectInterval: number = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: any[] = [];
  private isConnected: boolean = false;

  constructor(private url: string, private clientId: 'extension' | 'figma') {
    this.connect();
  }

  private connect() {
    console.log('[Canvas Weaver Extension] Attempting WebSocket connection...');
    
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('[Canvas Weaver Extension] WebSocket connected');
        this.isConnected = true;
        
        // Clear reconnection timer
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        
        // Identify ourselves
        this.send({
          type: 'identify',
          id: this.clientId
        });
        
        // Send any queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          this.send(message);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[Canvas Weaver Extension] Received message:', message.type);
          
          if (message.type === 'identified') {
            console.log('[Canvas Weaver Extension] Successfully identified with server');
          } else if (message.type === 'connectionStatus') {
            console.log('[Canvas Weaver Extension] Connection status:', message.status);
          }
        } catch (error) {
          console.error('[Canvas Weaver Extension] Error parsing message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[Canvas Weaver Extension] WebSocket disconnected');
        this.isConnected = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[Canvas Weaver Extension] WebSocket error:', error);
        this.isConnected = false;
      };
    } catch (error) {
      console.error('[Canvas Weaver Extension] Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      console.log(`[Canvas Weaver Extension] Scheduling reconnection in ${this.reconnectInterval}ms`);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, this.reconnectInterval);
    }
  }

  public send(message: any) {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log('[Canvas Weaver Extension] Message sent:', message.type);
    } else {
      console.log('[Canvas Weaver Extension] Queueing message (not connected):', message.type);
      this.messageQueue.push(message);
    }
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Initialize WebSocket client
const wsClient = new WebSocketClient('ws://localhost:8080', 'extension');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Canvas Weaver Extension] Received message from content script:', request.type);
  
  if (request.type === 'componentCaptured' && request.imageBase64) {
    console.log('[Canvas Weaver Extension] Processing captured component');
    
    // Wrap the base64 string in our protocol
    const payload = {
      type: 'componentData',
      payload: {
        imageBase64: request.imageBase64,
        metadata: {
          url: sender.tab?.url || '',
          timestamp: new Date().toISOString(),
          dimensions: request.dimensions || {}
        }
      }
    };
    
    // Send via WebSocket
    wsClient.send(payload);
    
    // Acknowledge receipt
    sendResponse({ success: true, message: 'Component data sent to Figma' });
  }
  
  return true; // Keep message channel open for async response
});

// Handle extension lifecycle
chrome.runtime.onSuspend.addListener(() => {
  console.log('[Canvas Weaver Extension] Extension suspending, closing WebSocket');
  wsClient.disconnect();
});