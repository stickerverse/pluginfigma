import { h, Fragment } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { 
  Banner, 
  Button, 
  Container, 
  Divider,
  LoadingIndicator,
  Preview,
  render,
  Stack, 
  Tabs,
  Text, 
  VerticalSpace 
} from '@create-figma-plugin/ui'
import { emit } from '@create-figma-plugin/utilities'
import Tesseract from 'tesseract.js'

// WebSocket connection management
class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimeout: number | null = null;
  private listeners: Map<string, Function[]> = new Map();
  
  connect(url: string): void {
    this.url = url;
    this.reconnectAttempts = 0;
    this.attemptConnection();
  }
  
  private attemptConnection(): void {
    if (!this.url) return;
    
    try {
      console.log(`[WebSocket Bridge] Connecting to ${this.url}`);
      
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('[WebSocket Bridge] Connection established');
        this.reconnectAttempts = 0;
        this.emit('connected', { url: this.url });
        
        // Identify as Figma UI
        this.send(JSON.stringify({
          type: 'identify',
          id: 'figma-ui'
        }));
        
        // Forward connection success to plugin
        parent.postMessage({
          pluginMessage: {
            source: 'websocket',
            type: 'connected'
          }
        }, '*');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[WebSocket Bridge] Received message:', message.type || 'unknown');
          
          // Forward message to plugin
          parent.postMessage({
            pluginMessage: {
              source: 'websocket',
              type: message.type || 'message',
              data: message
            }
          }, '*');
          
          this.emit('message', message);
        } catch (error) {
          console.error('[WebSocket Bridge] Error parsing message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('[WebSocket Bridge] Connection closed');
        this.ws = null;
        
        // Forward disconnection to plugin
        parent.postMessage({
          pluginMessage: {
            source: 'websocket',
            type: 'disconnected'
          }
        }, '*');
        
        this.emit('disconnected', {});
        this.scheduleReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('[WebSocket Bridge] Connection error:', error);
        this.emit('error', { error });
        
        // Forward error to plugin
        parent.postMessage({
          pluginMessage: {
            source: 'websocket',
            type: 'error',
            error: 'WebSocket connection error'
          }
        }, '*');
      };
    } catch (error) {
      console.error('[WebSocket Bridge] Failed to establish connection:', error);
      
      // Forward error to plugin
      parent.postMessage({
        pluginMessage: {
          source: 'websocket',
          type: 'error',
          error: error instanceof Error ? error.message : 'Failed to connect to WebSocket'
        }
      }, '*');
      
      this.scheduleReconnect();
    }
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocket Bridge] Max reconnect attempts reached');
      this.emit('max-reconnect-attempts', {});
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    console.log(`[WebSocket Bridge] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectAttempts++;
      this.attemptConnection();
    }, delay);
  }
  
  send(data: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket Bridge] Cannot send message: not connected');
      return false;
    }
    
    try {
      this.ws.send(data);
      return true;
    } catch (error) {
      console.error('[WebSocket Bridge] Error sending message:', error);
      return false;
    }
  }
  
  close(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        console.error('[WebSocket Bridge] Error closing connection:', error);
      }
      this.ws = null;
    }
  }
  
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }
  
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
  
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

interface TextBlock {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface ConnectionStatus {
  extension: boolean;
  server: boolean;
  lastUpdate: number;
}

interface ProcessingState {
  stage: 'idle' | 'analyzing' | 'processing' | 'generating' | 'complete' | 'error';
  progress: number;
  message: string;
}

interface Settings {
  autoProcess: boolean;
  showNotifications: boolean;
  ocrLanguage: string;
  qualityMode: 'fast' | 'balanced' | 'high';
}

// Create a singleton WebSocket manager instance
const webSocketManager = new WebSocketManager();

function Plugin() {
  const [tesseractWorker, setTesseractWorker] = useState<Tesseract.Worker | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    extension: false,
    server: false,
    lastUpdate: Date.now()
  });
  const [processingState, setProcessingState] = useState<ProcessingState>({
    stage: 'idle',
    progress: 0,
    message: 'Ready'
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({
    autoProcess: true,
    showNotifications: true,
    ocrLanguage: 'eng',
    qualityMode: 'balanced'
  });
  const [activeTab, setActiveTab] = useState<string>('capture');
  const [showSettings, setShowSettings] = useState(false);
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Initialize Tesseract worker
  useEffect(() => {
    let isMounted = true;
    
    const initTesseract = async () => {
      try {
        console.log('[Canvas Weaver UI] Initializing Tesseract.js...');
        setProcessingState({
          stage: 'analyzing',
          progress: 20,
          message: 'Initializing OCR engine...'
        });
        
        const worker = await Tesseract.createWorker();
        
        if (isMounted) {
          setProcessingState({
            stage: 'analyzing',
            progress: 60,
            message: 'Loading language data...'
          });
        }
        
        await worker.loadLanguage(settings.ocrLanguage);
        await worker.initialize(settings.ocrLanguage);
        
        if (isMounted) {
          setTesseractWorker(worker);
          workerRef.current = worker;
          setIsInitializing(false);
          setProcessingState({
            stage: 'idle',
            progress: 100,
            message: 'OCR engine ready!'
          });
          console.log('[Canvas Weaver UI] Tesseract.js initialized successfully');
        }
      } catch (error) {
        console.error('[Canvas Weaver UI] Failed to initialize Tesseract:', error);
        if (isMounted) {
          setInitError(error instanceof Error ? error.message : 'Failed to initialize OCR');
          setIsInitializing(false);
          setProcessingState({
            stage: 'error',
            progress: 0,
            message: 'OCR initialization failed'
          });
        }
      }
    };

    initTesseract();

    return () => {
      isMounted = false;
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [settings.ocrLanguage]);

  // Handle plugin messages, including WebSocket bridge requests
  useEffect(() => {
    const onPluginMessage = (event: MessageEvent) => {
      const message = event.data.pluginMessage;
      if (!message) return;
      
      console.log('[Canvas Weaver UI] Received plugin message:', message.type);
      
      switch (message.type) {
        case 'connect-to-websocket':
          try {
            webSocketManager.connect(message.url);
          } catch (error) {
            console.error('[Canvas Weaver UI] Failed to connect to WebSocket:', error);
            parent.postMessage({
              pluginMessage: {
                source: 'websocket',
                type: 'error',
                error: error instanceof Error ? error.message : 'Failed to connect to WebSocket'
              }
            }, '*');
          }
          break;
          
        case 'process-image':
          // Forward image processing request to WebSocket server
          if (webSocketManager.isConnected()) {
            webSocketManager.send(JSON.stringify({
              type: 'process-image',
              requestId: `ui_${Date.now()}`,
              data: {
                base64: message.base64,
                options: message.options || {}
              }
            }));
          } else {
            // Notify plugin that server is not connected
            parent.postMessage({
              pluginMessage: {
                source: 'websocket',
                type: 'error',
                error: 'WebSocket server not connected'
              }
            }, '*');
          }
          break;
          
        case 'close-websocket':
          webSocketManager.close();
          break;
      }
    };
    
    window.addEventListener('message', onPluginMessage);
    
    // WebSocket status monitoring for UI updates
    const onWsConnected = () => {
      setWsConnected(true);
      setConnectionStatus(prev => ({
        ...prev,
        server: true,
        lastUpdate: Date.now()
      }));
    };
    
    const onWsDisconnected = () => {
      setWsConnected(false);
      setConnectionStatus(prev => ({
        ...prev,
        server: false
      }));
    };
    
    webSocketManager.on('connected', onWsConnected);
    webSocketManager.on('disconnected', onWsDisconnected);
    
    return () => {
      window.removeEventListener('message', onPluginMessage);
      webSocketManager.off('connected', onWsConnected);
      webSocketManager.off('disconnected', onWsDisconnected);
    };
  }, []);
  
  // Monitor connection status to Chrome extension
  useEffect(() => {
    const checkConnection = () => {
      // Send ping to check if extension is connected
      window.postMessage({
        source: 'sticker-figma-plugin',
        type: 'ping-extension'
      }, '*');
    };

    // Check connection initially and every 5 seconds
    checkConnection();
    const interval = setInterval(checkConnection, 5000);

    const handleMessage = (event: MessageEvent) => {
      if (event.data.source === 'sticker-chrome-extension') {
        if (event.data.type === 'pong') {
          setConnectionStatus(prev => ({
            ...prev,
            extension: true,
            lastUpdate: Date.now()
          }));
        } else if (event.data.type === 'component-captured') {
          setImagePreview(event.data.imageData);
          if (settings.autoProcess) {
            handleAutoProcess(event.data);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
    };
  }, [settings.autoProcess]);

  // Check for stale connections
  useEffect(() => {
    const checkStaleConnections = () => {
      const now = Date.now();
      setConnectionStatus(prev => ({
        ...prev,
        extension: now - prev.lastUpdate < 10000 // Consider disconnected if no update in 10s
      }));
    };

    const interval = setInterval(checkStaleConnections, 2000);
    return () => clearInterval(interval);
  }, []);

  // Handle OCR operations with progress tracking
  const performOCR = useCallback(async (imageData: {
    base64: string;
    width: number;
    height: number;
  }): Promise<TextBlock[]> => {
    if (!tesseractWorker) {
      throw new Error('Tesseract worker not initialized');
    }

    try {
      console.log('[Canvas Weaver UI] Starting OCR recognition...');
      
      setProcessingState({
        stage: 'processing',
        progress: 0,
        message: 'Analyzing image...'
      });
      
      // Perform OCR with optimized settings for UI text
      const { data } = await tesseractWorker.recognize(imageData.base64);

      setProcessingState({
        stage: 'generating',
        progress: 80,
        message: 'Processing OCR results...'
      });

      console.log('[Canvas Weaver UI] OCR completed, found', data.text.length, 'characters');

      // Process OCR results and convert to TextBlock format  
      const textBlocks: TextBlock[] = [];
      for (const line of data.lines) {
        if (line.confidence > 30) { // Filter out low-confidence results
          textBlocks.push({
            text: line.text.trim(),
            confidence: line.confidence / 100, // Convert to 0-1 range
            bbox: {
              x0: line.bbox.x0,
              y0: line.bbox.y0,
              x1: line.bbox.x1,
              y1: line.bbox.y1
            }
          });
        }
      }

      // Merge nearby text blocks
      const mergedBlocks = mergeNearbyTextBlocks(textBlocks);
      console.log('[Canvas Weaver UI] OCR found', mergedBlocks.length, 'text blocks');
      
      setProcessingState({
        stage: 'complete',
        progress: 100,
        message: `Found ${mergedBlocks.length} text blocks`
      });

      return mergedBlocks;
    } catch (error) {
      console.error('[Canvas Weaver UI] OCR failed:', error);
      setProcessingState({
        stage: 'error',
        progress: 0,
        message: 'OCR processing failed'
      });
      throw error;
    }
  }, [tesseractWorker]);

  // Listen for OCR requests from main plugin
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg || msg.type !== 'performOCR') return;

      const { operationId, imageData } = msg;
      
      try {
        const result = await performOCR(imageData);
        
        // Send result back to main plugin
        parent.postMessage({
          pluginMessage: {
            type: 'ocrResult',
            operationId,
            success: true,
            result
          }
        }, '*');
      } catch (error) {
        // Send error back to main plugin
        parent.postMessage({
          pluginMessage: {
            type: 'ocrResult',
            operationId,
            success: false,
            error: error instanceof Error ? error.message : 'OCR failed'
          }
        }, '*');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [performOCR]);

  // Handle automatic processing when component is captured
  const handleAutoProcess = useCallback(async (data: any) => {
    if (!settings.autoProcess) return;
    
    setProcessingState({
      stage: 'analyzing',
      progress: 10,
      message: 'Auto-processing captured component...'
    });

    // Simulate processing steps
    setTimeout(() => {
      setProcessingState({
        stage: 'generating',
        progress: 70,
        message: 'Generating Figma layers...'
      });
    }, 1000);

    setTimeout(() => {
      setProcessingState({
        stage: 'complete',
        progress: 100,
        message: 'Component ready!'
      });
      
      if (settings.showNotifications) {
        emit('SHOW_NOTIFICATION', { message: 'Component successfully processed!' });
      }
    }, 2000);
  }, [settings.autoProcess, settings.showNotifications]);

  const handleCreateComponentClick = useCallback(function () {
    setProcessingState({
      stage: 'generating',
      progress: 50,
      message: 'Creating Figma component...'
    });
    
    emit('IMAGE_ANALYSIS_COMPLETE', { success: true });
    
    setTimeout(() => {
      setProcessingState({
        stage: 'complete',
        progress: 100,
        message: 'Component created successfully!'
      });
    }, 1500);
  }, []);

  const handleCloseButtonClick = useCallback(function () {
    emit('CLOSE_PLUGIN');
  }, []);

  const handleRetryConnection = useCallback(() => {
    setConnectionStatus(prev => ({
      ...prev,
      extension: false,
      server: false
    }));
    
    // Try to reconnect
    window.postMessage({
      source: 'sticker-figma-plugin',
      type: 'reconnect-extension'
    }, '*');
  }, []);

  const handleClearPreview = useCallback(() => {
    setImagePreview(null);
    setProcessingState({
      stage: 'idle',
      progress: 0,
      message: 'Ready'
    });
  }, []);

  const handleSettingsUpdate = useCallback((newSettings: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Connection status component
  const ConnectionStatus = () => (
    <Stack space="extraSmall">
      <Stack space="extraSmall">
        <div style={{ 
          width: '8px', 
          height: '8px', 
          borderRadius: '50%', 
          backgroundColor: connectionStatus.extension ? '#0f7b0f' : '#e53e3e',
          marginTop: '6px'
        }} />
        <Text>
          Extension: {connectionStatus.extension ? 'Connected' : 'Disconnected'}
        </Text>
      </Stack>
      <Stack space="extraSmall">
        <div style={{ 
          width: '8px', 
          height: '8px', 
          borderRadius: '50%', 
          backgroundColor: connectionStatus.server ? '#0f7b0f' : '#718096',
          marginTop: '6px'
        }} />
        <Text>
          Server: {connectionStatus.server ? 'Connected' : 'Offline'}
        </Text>
      </Stack>
      {!connectionStatus.extension && (
        <Button onClick={handleRetryConnection} secondary>
          Retry Connection
        </Button>
      )}
    </Stack>
  );

  // Processing progress component
  const ProcessingProgress = () => {
    if (processingState.stage === 'idle') return null;
    
    return (
      <Stack space="small">
        {imagePreview && (
          <Preview>
            <img 
              src={imagePreview} 
              alt="Captured component" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '200px',
                borderRadius: '4px'
              }} 
            />
          </Preview>
        )}
      </Stack>
  );

  const tabOptions = [
    { value: 'capture', children: 'Capture' },
    { value: 'convert', children: 'Convert' },
    { value: 'history', children: 'History' },
    { value: 'status', children: 'Status' }
  ];

  const renderServerStatus = () => (
    <Stack space="medium">
      <Text>
        <strong>WebSocket Server:</strong> {wsConnected ? '✅ Connected' : '❌ Disconnected'}
      </Text>
      <Text>
        <strong>Chrome Extension:</strong> {connectionStatus.extension ? '✅ Connected' : '❌ Disconnected'}
      </Text>
      <Button
        onClick={() => webSocketManager.connect('ws://localhost:8080')}
        disabled={wsConnected}
      >
        {wsConnected ? 'Connected to Server' : 'Connect to Server'}
      </Button>
      <Divider />
      <Text>
        <strong>Server Address:</strong> ws://localhost:8080
      </Text>
      <Text>
        <strong>API Endpoint:</strong> http://localhost:3000/api/process-image
      </Text>
    </Stack>
  );

  return (
    <Container space="medium">
      {isInitializing ? (
        <VerticalSpace space="large" />
      ) : (
        <Fragment></Fragment>
      )}
      
      {/* Header */}
      <Stack space="medium">
        <Text>
          <h2>Canvas Weaver</h2>
        </Text>
        <Text>
          Transform images into editable Figma components with AI-powered analysis.
        </Text>
      </Stack>

      <VerticalSpace space="medium" />

      {/* Connection Status */}
      <Stack space="small">
        <Text>
          <strong>Connection Status</strong>
        </Text>
        <ConnectionStatus />
      </Stack>

      <VerticalSpace space="medium" />

      {/* Tab Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        options={[
          { value: 'capture', children: 'Capture' },
          { value: 'settings', children: 'Settings' }
        ]}
      />

      <VerticalSpace space="medium" />

      {/* Main Content */}
      {activeTab === 'capture' && (
        <Stack space="medium">
          {/* OCR Status */}
          {isInitializing && (
            <Stack space="small">
              <Text>🔤 Initializing OCR engine...</Text>
              <LoadingIndicator />
            </Stack>
          )}
          
          {initError && (
            <Banner variant="warning" icon="❌">
              OCR initialization failed: {initError}
            </Banner>
          )}
          
          {!isInitializing && !initError && (
            <Banner variant="success" icon="✅">
              OCR engine ready!
            </Banner>
          )}

          {/* Processing Progress */}
          <ProcessingProgress />

          {/* Image Preview */}
          <ImagePreviewComponent />

          {/* Action Buttons */}
          <Stack space="small">
            <Button 
              fullWidth 
              onClick={handleCreateComponentClick}
              disabled={isInitializing || processingState.stage === 'processing'}
            >
              {processingState.stage === 'processing' ? 'Processing...' : 'Create Component'}
            </Button>
            <Button fullWidth onClick={handleCloseButtonClick} secondary>
              Close
            </Button>
          </Stack>
        </Stack>
      )}

      {activeTab === 'settings' && (
        <SettingsPanel />
      )}

      <VerticalSpace space="small" />
    </Container>
  );
}

// Helper function to merge nearby text blocks
function mergeNearbyTextBlocks(textBlocks: TextBlock[]): TextBlock[] {
  if (textBlocks.length <= 1) return textBlocks;
  
  const merged: TextBlock[] = [];
  const processed = new Set<number>();
  
  for (let i = 0; i < textBlocks.length; i++) {
    if (processed.has(i)) continue;
    
    const currentBlock = textBlocks[i];
    const mergeGroup = [currentBlock];
    processed.add(i);
    
    // Find nearby blocks to merge
    for (let j = i + 1; j < textBlocks.length; j++) {
      if (processed.has(j)) continue;
      
      const otherBlock = textBlocks[j];
      
      // Check if blocks are on the same line (similar y-coordinates)
      const currentCenterY = (currentBlock.bbox.y0 + currentBlock.bbox.y1) / 2;
      const otherCenterY = (otherBlock.bbox.y0 + otherBlock.bbox.y1) / 2;
      const heightThreshold = Math.max(
        currentBlock.bbox.y1 - currentBlock.bbox.y0,
        otherBlock.bbox.y1 - otherBlock.bbox.y0
      ) * 0.5;
      
      // Check horizontal distance
      const horizontalGap = Math.min(
        Math.abs(currentBlock.bbox.x1 - otherBlock.bbox.x0),
        Math.abs(otherBlock.bbox.x1 - currentBlock.bbox.x0)
      );
      
      if (Math.abs(currentCenterY - otherCenterY) <= heightThreshold && horizontalGap <= 50) {
        mergeGroup.push(otherBlock);
        processed.add(j);
      }
    }
    
    // Merge the group
    if (mergeGroup.length === 1) {
      merged.push(currentBlock);
    } else {
      // Sort by x-coordinate and merge
      mergeGroup.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      
      const mergedText = mergeGroup.map(block => block.text).join(' ');
      const avgConfidence = mergeGroup.reduce((sum, block) => sum + block.confidence, 0) / mergeGroup.length;
      
      const minX = Math.min(...mergeGroup.map(b => b.bbox.x0));
      const minY = Math.min(...mergeGroup.map(b => b.bbox.y0));
      const maxX = Math.max(...mergeGroup.map(b => b.bbox.x1));
      const maxY = Math.max(...mergeGroup.map(b => b.bbox.y1));
      
      merged.push({
        text: mergedText,
        confidence: avgConfidence,
        bbox: { x0: minX, y0: minY, x1: maxX, y1: maxY }
      });
    }
  }
  
  return merged;
}

// Image Preview Component
function ImagePreviewComponent(): JSX.Element | null {
  return null; // Placeholder for now
}

// Settings Panel Component  
function SettingsPanel() {
  return (
    <Stack space="medium">
      <Text>Settings panel content will go here</Text>
    </Stack>
  );
}

export default render(Plugin);
