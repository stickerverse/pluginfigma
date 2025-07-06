import { h } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { 
  Banner, 
  Button, 
  Container, 
  Disclosure,
  Divider,
  IconButton,
  LoadingIndicator,
  Preview,
  render,
  SegmentedControl,
  Stack, 
  Tabs,
  Text, 
  Toggle,
  VerticalSpace 
} from '@create-figma-plugin/ui'
import { emit } from '@create-figma-plugin/utilities'
import * as Tesseract from 'tesseract.js'

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
      const { data } = await tesseractWorker.recognize(imageData.base64, {
        logger: m => {
          if (m.status === 'recognizing text') {
            const progress = Math.round(m.progress * 100);
            setProcessingState(prev => ({
              ...prev,
              progress,
              message: `Processing OCR: ${progress}%`
            }));
            console.log(`[Canvas Weaver UI] OCR Progress: ${progress}%`);
          }
        }
      });

      setProcessingState({
        stage: 'generating',
        progress: 80,
        message: 'Processing OCR results...'
      });

      console.log('[Canvas Weaver UI] OCR completed, found', data.words.length, 'words');

      // Process OCR results and convert to TextBlock format
      const textBlocks: TextBlock[] = [];
      for (const word of data.words) {
        if (word.confidence > 30) { // Filter out low-confidence results
          textBlocks.push({
            text: word.text.trim(),
            confidence: word.confidence / 100, // Convert to 0-1 range
            bbox: {
              x0: word.bbox.x0,
              y0: word.bbox.y0,
              x1: word.bbox.x1,
              y1: word.bbox.y1
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
      <Stack direction="row" space="extraSmall">
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
      <Stack direction="row" space="extraSmall">
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
        <Text>{processingState.message}</Text>
        {processingState.stage !== 'complete' && processingState.stage !== 'error' && (
          <LoadingIndicator />
        )}
        {processingState.stage === 'error' && (
          <Banner variant="warning">
            Processing failed. Please try again.
          </Banner>
        )}
        {processingState.stage === 'complete' && (
          <Banner variant="success">
            Processing completed successfully!
          </Banner>
        )}
      </Stack>
    );
  };

  // Image preview component
  const ImagePreviewComponent = () => {
    if (!imagePreview) return null;
    
    return (
      <Stack space="small">
        <Stack direction="row" space="small">
          <Text>Preview:</Text>
          <Button onClick={handleClearPreview} secondary>
            Clear
          </Button>
        </Stack>
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
      </Stack>
    );
  };

  // Settings panel component
  const SettingsPanel = () => (
    <Stack space="medium">
      <Text>
        <strong>Settings</strong>
      </Text>
      <Divider />
      
      <Stack space="small">
        <Text>Auto-process captured components:</Text>
        <Toggle 
          value={settings.autoProcess} 
          onValueChange={(value) => handleSettingsUpdate({ autoProcess: value })}
        />
      </Stack>
      
      <Stack space="small">
        <Text>Show notifications:</Text>
        <Toggle 
          value={settings.showNotifications} 
          onValueChange={(value) => handleSettingsUpdate({ showNotifications: value })}
        />
      </Stack>
      
      <Stack space="small">
        <Text>Processing quality:</Text>
        <SegmentedControl 
          value={settings.qualityMode}
          onValueChange={(value) => handleSettingsUpdate({ qualityMode: value as 'fast' | 'balanced' | 'high' })}
          options={[
            { value: 'fast', children: 'Fast' },
            { value: 'balanced', children: 'Balanced' },
            { value: 'high', children: 'High' }
          ]}
        />
      </Stack>
    </Stack>
  );

  return (
    <Container space="medium">
      <VerticalSpace space="large" />
      
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
            <Banner variant="warning">
              ❌ OCR initialization failed: {initError}
            </Banner>
          )}
          
          {!isInitializing && !initError && (
            <Banner variant="success">
              ✅ OCR engine ready!
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

export default render(Plugin)
