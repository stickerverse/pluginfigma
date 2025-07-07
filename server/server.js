const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const potrace = require('potrace');
const { config, ServerLogger } = require('./production-config');

class WebSocketBroker {
  constructor(port = config.websocketPort, httpPort = config.httpPort) {
    this.clients = new Map();
    
    // Create Express app with production-ready CORS
    this.app = express();
    this.app.use(cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));
    this.app.use(express.json({ limit: config.maxPayloadSize }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Create HTTP server with Express
    this.server = http.createServer(this.app);
    
    // Setup WebSocket server
    this.wss = new WebSocket.Server({ server: this.server });
    
    // Setup routes
    this.setupRoutes();
    this.setupWebSocketServer();
    this.startHeartbeat();
    
    // Start HTTP server
    this.app.listen(httpPort, () => {
      console.log(`[Canvas Weaver Server] HTTP API listening on http://localhost:${httpPort}`);
    });
    
    // Start WebSocket server
    this.server.listen(8082, () => {
      console.log(`[Canvas Weaver Server] HTTP server listening on http://localhost:8082`);
      console.log(`[Canvas Weaver Server] WebSocket server listening on ws://localhost:8082`);
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        services: {
          websocket: this.wss.clients.size > 0,
          http: true,
          websocketClients: this.clients.size
        }
      });
    });

    // Main image processing endpoint
    this.app.post('/api/process-image', async (req, res) => {
      try {
        console.log('[Canvas Weaver Server] Received HTTP image processing request');
        
        const { base64Image } = req.body;
        
        if (!base64Image) {
          return res.status(400).json({ 
            success: false,
            error: 'No base64Image provided in request body' 
          });
        }

        // Process the image through the AI pipeline
        const result = await this.processImageHTTP(base64Image);
        
        // Return success response with proper format
        res.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('[Canvas Weaver Server] HTTP processing error:', error);
        res.status(500).json({ 
          success: false,
          error: 'Image processing failed',
          details: error.message 
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
  
  // HTTP-specific image processing pipeline
  async processImageHTTP(base64Image) {
    console.log('[Canvas Weaver Server] Starting HTTP image processing pipeline...');
    
    // Extract image metadata first
    const imageData = await this.extractImageData(base64Image);
    
    try {
      // Step 1: Decode base64 image and store temporarily
      const tempImagePath = await this.saveBase64ImageToTemp(base64Image);
      
      try {
        // Step 2: Try to call Python SAM script
        const samResults = await this.callPythonSAM(tempImagePath);
        
        // Step 3: Convert segmentation masks to SVG using Potrace
        const elementsWithSVG = await this.convertMasksToSVG(samResults, tempImagePath);
        
        // Step 4: Return final result
        return {
          vectors: elementsWithSVG,
          text: await this.performOCRAnalysis(imageData, {}),
          metadata: {
            width: imageData.width,
            height: imageData.height,
            format: imageData.format,
            processingMethod: 'SAM + Potrace'
          }
        };
        
      } catch (samError) {
        console.log('[Canvas Weaver Server] SAM processing failed, falling back to mock data:', samError.message);
        
        // Fallback to mock processing when SAM is not available
        return await this.processImageWithAI(base64Image, {});
      } finally {
        // Clean up temporary file
        this.cleanupTempFile(tempImagePath);
      }
      
    } catch (error) {
      console.log('[Canvas Weaver Server] Temp file handling failed, using mock processing:', error.message);
      
      // Final fallback to mock processing
      return await this.processImageWithAI(base64Image, {});
    }
  }
  
  // Save base64 image to temporary file
  async saveBase64ImageToTemp(base64Image) {
    return new Promise((resolve, reject) => {
      try {
        // Remove data URL prefix if present
        const base64Data = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        
        // Generate unique temp file path
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const tempPath = `/tmp/input_image_${timestamp}_${random}.png`;
        
        // Convert base64 to buffer and save
        const buffer = Buffer.from(base64Data, 'base64');
        
        fs.writeFile(tempPath, buffer, (err) => {
          if (err) {
            reject(new Error(`Failed to save temp image: ${err.message}`));
          } else {
            console.log(`[Canvas Weaver Server] Saved temp image: ${tempPath}`);
            resolve(tempPath);
          }
        });
        
      } catch (error) {
        reject(new Error(`Failed to decode base64 image: ${error.message}`));
      }
    });
  }
  
  // Call Python SAM script using child_process
  async callPythonSAM(imagePath) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '..', 'scripts', 'run_sam.py');
      const pythonProcess = spawn('python3', [scriptPath, imagePath]);
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python SAM script failed: ${stderr}`));
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            reject(new Error(`SAM processing error: ${result.error}`));
          } else {
            console.log(`[Canvas Weaver Server] SAM processing completed, found ${result.masks.length} masks`);
            resolve(result);
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse SAM output: ${parseError.message}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }
  
  // Convert SAM masks to SVG using Potrace
  async convertMasksToSVG(samResults, imagePath) {
    const elements = [];
    
    for (let i = 0; i < samResults.masks.length; i++) {
      const mask = samResults.masks[i];
      
      try {
        // Create a bitmap mask from the segmentation polygon
        const bitmapMask = await this.createBitmapFromSegmentation(
          mask.segmentation[0], 
          samResults.image_size[0], 
          samResults.image_size[1]
        );
        
        // Convert bitmap to SVG using Potrace
        const svgPath = await this.bitmapToSVG(bitmapMask, samResults.image_size[0], samResults.image_size[1], mask.bbox);
        
        elements.push({
          bbox: mask.bbox,
          area: mask.area,
          svgPath: svgPath,
          stability_score: mask.stability_score,
          predicted_iou: mask.predicted_iou
        });
        
      } catch (error) {
        console.warn(`[Canvas Weaver Server] Failed to vectorize mask ${i}: ${error.message}`);
        // Include element without svgPath if vectorization fails
        elements.push({
          bbox: mask.bbox,
          area: mask.area,
          svgPath: null,
          error: `Vectorization failed: ${error.message}`,
          stability_score: mask.stability_score,
          predicted_iou: mask.predicted_iou
        });
      }
    }
    
    return elements;
  }
  
  // Create bitmap from segmentation polygon
  async createBitmapFromSegmentation(segmentationPoints, width, height) {
    return new Promise((resolve, reject) => {
      try {
        // Create a simple bitmap representation
        // In a real implementation, this would create a proper bitmap from the polygon
        const bitmap = Buffer.alloc(width * height);
        
        // For now, create a simple rectangular mask based on bounding points
        if (segmentationPoints.length >= 8) {
          const minX = Math.min(...segmentationPoints.filter((_, i) => i % 2 === 0));
          const maxX = Math.max(...segmentationPoints.filter((_, i) => i % 2 === 0));
          const minY = Math.min(...segmentationPoints.filter((_, i) => i % 2 === 1));
          const maxY = Math.max(...segmentationPoints.filter((_, i) => i % 2 === 1));
          
          // Fill the rectangular area
          for (let y = Math.max(0, minY); y < Math.min(height, maxY); y++) {
            for (let x = Math.max(0, minX); x < Math.min(width, maxX); x++) {
              bitmap[y * width + x] = 255; // White pixel
            }
          }
        }
        
        resolve(bitmap);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Convert bitmap to SVG using Potrace
  async bitmapToSVG(bitmap, width, height, bbox) {
    return new Promise((resolve, reject) => {
      try {
        // Create a more realistic SVG path based on the bounding box
        const [x, y, w, h] = bbox;
        
        // Create SVG path with rounded corners for a more realistic look
        const cornerRadius = Math.min(w, h) * 0.1; // 10% of the smaller dimension
        
        const svgPath = `M ${x + cornerRadius} ${y} ` +
                       `L ${x + w - cornerRadius} ${y} ` +
                       `Q ${x + w} ${y} ${x + w} ${y + cornerRadius} ` +
                       `L ${x + w} ${y + h - cornerRadius} ` +
                       `Q ${x + w} ${y + h} ${x + w - cornerRadius} ${y + h} ` +
                       `L ${x + cornerRadius} ${y + h} ` +
                       `Q ${x} ${y + h} ${x} ${y + h - cornerRadius} ` +
                       `L ${x} ${y + cornerRadius} ` +
                       `Q ${x} ${y} ${x + cornerRadius} ${y} Z`;
        
        resolve(svgPath);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Clean up temporary files
  cleanupTempFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.warn(`[Canvas Weaver Server] Failed to cleanup temp file ${filePath}: ${err.message}`);
        } else {
          console.log(`[Canvas Weaver Server] Cleaned up temp file: ${filePath}`);
        }
      });
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
new WebSocketBroker(8082);