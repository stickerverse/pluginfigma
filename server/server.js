const WebSocket = require('ws');
const http = require('http');

class WebSocketBroker {
  constructor(port = 8080) {
    this.clients = new Map();
    this.server = http.createServer();
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.setupWebSocketServer();
    this.startHeartbeat();
    
    this.server.listen(port, () => {
      console.log(`[Canvas Weaver Server] WebSocket broker listening on ws://localhost:${port}`);
    });
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      console.log('[Canvas Weaver Server] New connection attempt');
      
      let clientId = null;

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Handle initial identification
          if (message.type === 'identify') {
            clientId = message.id;
            
            if (clientId === 'figma' || clientId === 'extension') {
              // Remove any existing client with same ID
              const existing = this.clients.get(clientId);
              if (existing) {
                console.log(`[Canvas Weaver Server] Replacing existing ${clientId} connection`);
                existing.ws.close();
              }
              
              // Register new client
              this.clients.set(clientId, {
                id: clientId,
                ws,
                isAlive: true
              });
              
              console.log(`[Canvas Weaver Server] Client registered: ${clientId}`);
              ws.send(JSON.stringify({ type: 'identified', status: 'connected' }));
              
              // Notify other client of connection
              this.notifyConnectionStatus();
            } else {
              console.error('[Canvas Weaver Server] Invalid client ID:', clientId);
              ws.close();
            }
          } 
          // Handle message forwarding
          else if (clientId) {
            const targetId = clientId === 'figma' ? 'extension' : 'figma';
            const target = this.clients.get(targetId);
            
            console.log(`[Canvas Weaver Server] Forwarding message from ${clientId} to ${targetId}`);
            console.log('[Canvas Weaver Server] Message type:', message.type);
            
            if (target && target.ws.readyState === WebSocket.OPEN) {
              target.ws.send(JSON.stringify(message));
              console.log('[Canvas Weaver Server] Message forwarded successfully');
            } else {
              console.warn(`[Canvas Weaver Server] Target ${targetId} not connected`);
              ws.send(JSON.stringify({ 
                type: 'error', 
                message: `Target ${targetId} is not connected` 
              }));
            }
          }
        } catch (error) {
          console.error('[Canvas Weaver Server] Error processing message:', error);
        }
      });

      ws.on('pong', () => {
        const client = clientId ? this.clients.get(clientId) : null;
        if (client) {
          client.isAlive = true;
        }
      });

      ws.on('close', () => {
        if (clientId) {
          console.log(`[Canvas Weaver Server] Client disconnected: ${clientId}`);
          this.clients.delete(clientId);
          this.notifyConnectionStatus();
        }
      });

      ws.on('error', (error) => {
        console.error(`[Canvas Weaver Server] WebSocket error for ${clientId}:`, error);
      });
    });
  }

  notifyConnectionStatus() {
    const status = {
      figma: this.clients.has('figma'),
      extension: this.clients.has('extension')
    };
    
    this.clients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'connectionStatus',
          status
        }));
      }
    });
  }

  startHeartbeat() {
    setInterval(() => {
      this.clients.forEach((client, id) => {
        if (!client.isAlive) {
          console.log(`[Canvas Weaver Server] Client ${id} failed heartbeat, terminating`);
          client.ws.terminate();
          this.clients.delete(id);
          this.notifyConnectionStatus();
          return;
        }
        
        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000); // 30 second heartbeat
  }
}

// Start the server
new WebSocketBroker(8080);
