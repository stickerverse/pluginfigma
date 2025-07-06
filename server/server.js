const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');

class WebSocketBroker {
  constructor(port = 8080, httpPort = 3000) {
    this.clients = new Map();
    
    // Setup Express HTTP server
    this.app = express();
    this.setupExpressServer();
    
    // Setup WebSocket server  
    this.server = http.createServer();
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.setupWebSocketServer();
    this.startHeartbeat();
    
    // Start HTTP server
    this.app.listen(httpPort, () => {
      console.log(`[Canvas Weaver Server] HTTP API listening on http://localhost:${httpPort}`);
    });
    
    // Start WebSocket server
    this.server.listen(port, () => {
      console.log(`[Canvas Weaver Server] WebSocket broker listening on ws://localhost:${port}`);
    });
  }

  setupExpressServer() {
    // Enable CORS for all routes
    this.app.use(cors());
    
    // Parse JSON bodies up to 10mb for large image data
    this.app.use(express.json({ limit: '10mb' }));
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        websocketClients: this.clients.size
      });
    });
    
    // Main image processing endpoint
    this.app.post('/api/process-image', async (req, res) => {
      try {
        console.log('[Canvas Weaver Server] Processing image request...');
        
        const { base64, options = {} } = req.body;
        
        if (!base64) {
          return res.status(400).json({ 
            error: 'No image data provided',
            message: 'Please provide base64 encoded image data' 
          });
        }
        
        // Process image with AI techniques
        const processedData = await this.processImageWithAI(base64, options);
        
        // Return structured response
        res.json({
          success: true,
          data: processedData,
          timestamp: new Date().toISOString()
        });
        
        console.log('[Canvas Weaver Server] Image processing completed successfully');
        
      } catch (error) {
        console.error('[Canvas Weaver Server] Image processing error:', error);
        
        res.status(500).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }
  
  // Process image with AI/ML techniques
  async processImageWithAI(base64, options = {}) {
    // Extract image metadata
    const imageData = await this.extractImageData(base64);
    
    // Simulate AI-powered image analysis
    const vectorElements = await this.generateVectorElements(imageData, options);
    const textElements = await this.performOCRAnalysis(imageData, options);
    
    return {
      vectors: vectorElements,
      text: textElements,
      metadata: {
        width: imageData.width,
        height: imageData.height,
        format: imageData.format
      }
    };
  }
  
  // Generate vector elements from image analysis
  async generateVectorElements(imageData, options) {
    // Simulate advanced AI segmentation and vectorization
    const mockVectorElements = [];
    
    // Generate some mock vector elements with realistic data
    const numElements = Math.floor(Math.random() * 5) + 2; // 2-6 elements
    
    for (let i = 0; i < numElements; i++) {
      const element = {
        id: `vector-${i}`,
        type: 'vector',
        bbox: {
          x: Math.floor(Math.random() * (imageData.width * 0.6)),
          y: Math.floor(Math.random() * (imageData.height * 0.6)),
          width: Math.floor(Math.random() * (imageData.width * 0.3)) + 50,
          height: Math.floor(Math.random() * (imageData.height * 0.3)) + 50
        },
        area: 0, // Will be calculated
        svgPath: this.generateMockSVGPath(i),
        fill: {
          r: Math.random() * 0.8 + 0.1,
          g: Math.random() * 0.8 + 0.1,
          b: Math.random() * 0.8 + 0.1
        },
        confidence: Math.random() * 0.3 + 0.7 // 0.7-1.0
      };
      
      // Calculate area
      element.area = element.bbox.width * element.bbox.height;
      
      mockVectorElements.push(element);
    }
    
    return mockVectorElements;
  }
  
  // Generate mock SVG path for vector element
  generateMockSVGPath(index) {
    const shapes = [
      'M 10 10 L 90 10 L 90 90 L 10 90 Z', // Rectangle
      'M 50 10 L 90 90 L 10 90 Z', // Triangle
      'M 50 10 A 40 40 0 1 1 49 10 Z', // Circle
      'M 10 50 Q 50 10 90 50 Q 50 90 10 50 Z' // Curved shape
    ];
    
    return shapes[index % shapes.length];
  }
  
  // Perform OCR analysis on image
  async performOCRAnalysis(imageData, options) {
    // Simulate OCR text detection
    const mockTextElements = [];
    
    // Generate some mock text elements
    const texts = [
      'Header Title',
      'Button Text',
      'Description text here',
      'Label',
      'Call to Action'
    ];
    
    const numTexts = Math.floor(Math.random() * 3) + 1; // 1-3 text elements
    
    for (let i = 0; i < numTexts; i++) {
      const text = texts[Math.floor(Math.random() * texts.length)];
      
      mockTextElements.push({
        id: `text-${i}`,
        type: 'text',
        text: text,
        bbox: {
          x: Math.floor(Math.random() * (imageData.width * 0.5)),
          y: Math.floor(Math.random() * (imageData.height * 0.5)),
          width: text.length * 8 + 20,
          height: 20 + Math.floor(Math.random() * 10)
        },
        fontSize: Math.floor(Math.random() * 8) + 12, // 12-20px
        fontFamily: 'Inter',
        fontWeight: Math.random() > 0.5 ? 'bold' : 'normal',
        color: {
          r: Math.random() * 0.3,
          g: Math.random() * 0.3,
          b: Math.random() * 0.3
        },
        confidence: Math.random() * 0.2 + 0.8 // 0.8-1.0
      });
    }
    
    return mockTextElements;
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
          // Handle image processing requests
          else if (message.type === 'processImage') {
            console.log('[Canvas Weaver Server] Processing image request');
            this.handleImageProcessing(message, ws);
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

  // Handle image processing requests
  async handleImageProcessing(message, ws) {
    try {
      console.log('[Canvas Weaver Server] Starting image processing...');
      
      // Validate base64 data
      if (!message.base64) {
        throw new Error('No image data provided');
      }
      
      // Extract image metadata
      const imageData = await this.extractImageData(message.base64);
      
      // Process image based on options
      const processedData = await this.processImage(imageData, message.options || {});
      
      // Send processed data back to client
      ws.send(JSON.stringify({
        type: 'processedImage',
        data: processedData,
        timestamp: new Date().toISOString()
      }));
      
      console.log('[Canvas Weaver Server] Image processing completed successfully');
      
    } catch (error) {
      console.error('[Canvas Weaver Server] Image processing error:', error);
      
      ws.send(JSON.stringify({
        type: 'processingError',
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  }
  
  // Extract image data from base64
  async extractImageData(base64) {
    // Remove data URL prefix if present
    const base64Data = base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    
    // For now, we'll simulate image analysis
    // In a real implementation, you'd use sharp or similar to analyze the image
    const mockImageData = {
      width: 400,
      height: 300,
      format: 'png',
      channels: 4,
      hasAlpha: true,
      base64: base64Data
    };
    
    return mockImageData;
  }
  
  // Process image with AI/ML techniques
  async processImage(imageData, options) {
    console.log('[Canvas Weaver Server] Processing with options:', options);
    
    // Mock processed data - in real implementation, this would use TensorFlow.js, OpenCV, etc.
    const processedData = {
      width: imageData.width,
      height: imageData.height,
      shapes: [],
      textBlocks: [],
      vectors: [],
      layout: null
    };
    
    // Mock shape detection
    if (options.useSegmentation) {
      processedData.shapes = [
        {
          type: 'rectangle',
          x: 20,
          y: 20,
          width: 200,
          height: 50,
          fill: { r: 0.2, g: 0.5, b: 1.0 },
          cornerRadius: 8
        },
        {
          type: 'rectangle',
          x: 20,
          y: 80,
          width: 360,
          height: 200,
          fill: { r: 0.95, g: 0.95, b: 0.95 },
          cornerRadius: 12
        }
      ];
    }
    
    // Mock text recognition
    if (options.useOCR) {
      processedData.textBlocks = [
        {
          text: 'Header Title',
          x: 30,
          y: 35,
          fontSize: 18,
          fontFamily: 'Inter',
          fontStyle: 'Bold',
          color: { r: 1, g: 1, b: 1 }
        },
        {
          text: 'This is some body text that was detected by OCR processing.',
          x: 30,
          y: 100,
          fontSize: 14,
          fontFamily: 'Inter',
          fontStyle: 'Regular',
          color: { r: 0.2, g: 0.2, b: 0.2 }
        }
      ];
    }
    
    // Mock vector detection
    if (options.useVectorization) {
      processedData.vectors = [
        {
          paths: 'M 250 40 L 260 50 L 250 60 L 240 50 Z',
          x: 240,
          y: 40,
          width: 20,
          height: 20,
          fill: { r: 0.1, g: 0.8, b: 0.4 }
        }
      ];
    }
    
    // Mock layout detection
    processedData.layout = {
      type: 'vertical',
      spacing: 16,
      padding: 20
    };
    
    return processedData;
  }
}

// Start the server
new WebSocketBroker(8080);
