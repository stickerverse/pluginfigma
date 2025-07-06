import { h } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { Button, Container, render, Stack, Text, VerticalSpace } from '@create-figma-plugin/ui'
import { emit } from '@create-figma-plugin/utilities'
import * as Tesseract from 'tesseract.js'

interface TextBlock {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

function Plugin() {
  const [tesseractWorker, setTesseractWorker] = useState<Tesseract.Worker | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const workerRef = useRef<Tesseract.Worker | null>(null);

  // Initialize Tesseract worker
  useEffect(() => {
    let isMounted = true;
    
    const initTesseract = async () => {
      try {
        console.log('[Canvas Weaver UI] Initializing Tesseract.js...');
        
        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        
        if (isMounted) {
          setTesseractWorker(worker);
          workerRef.current = worker;
          setIsInitializing(false);
          console.log('[Canvas Weaver UI] Tesseract.js initialized successfully');
        }
      } catch (error) {
        console.error('[Canvas Weaver UI] Failed to initialize Tesseract:', error);
        if (isMounted) {
          setInitError(error instanceof Error ? error.message : 'Failed to initialize OCR');
          setIsInitializing(false);
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
  }, []);

  // Handle OCR operations
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
      
      // Perform OCR with optimized settings for UI text
      const { data } = await tesseractWorker.recognize(imageData.base64, {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`[Canvas Weaver UI] OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
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
      
      return mergedBlocks;
    } catch (error) {
      console.error('[Canvas Weaver UI] OCR failed:', error);
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

  const handleCreateComponentClick = useCallback(function () {
    emit('IMAGE_ANALYSIS_COMPLETE', { success: true })
  }, [])

  const handleCloseButtonClick = useCallback(function () {
    emit('CLOSE_PLUGIN')
  }, [])

  return (
    <Container space="medium">
      <VerticalSpace space="large" />
      <Text>
        <h2>Canvas Weaver</h2>
      </Text>
      <VerticalSpace space="medium" />
      
      {isInitializing && (
        <Stack space="extraSmall">
          <Text>
            <p>🔤 Initializing OCR engine...</p>
          </Text>
        </Stack>
      )}
      
      {initError && (
        <Stack space="extraSmall">
          <Text style={{ color: 'red' }}>
            <p>❌ OCR initialization failed: {initError}</p>
          </Text>
        </Stack>
      )}
      
      {!isInitializing && !initError && (
        <Stack space="extraSmall">
          <Text>
            <p>✅ OCR engine ready!</p>
          </Text>
          <Text>
            <p>Transform images into editable Figma components with text recognition.</p>
          </Text>
        </Stack>
      )}

      <VerticalSpace space="large" />
      
      <Stack space="small">
        <Button fullWidth onClick={handleCreateComponentClick}>
          Create Component
        </Button>
        <Button fullWidth onClick={handleCloseButtonClick} secondary>
          Close
        </Button>
      </Stack>
      <VerticalSpace space="small" />
    </Container>
  )
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
