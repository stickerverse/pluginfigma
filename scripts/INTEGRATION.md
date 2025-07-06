# SAM Integration Guide

## Overview

The `scripts/run_sam.py` script is now ready for integration with the Canvas Weaver Figma plugin. This document provides examples of how to integrate the SAM script with the existing TypeScript codebase.

## Current Implementation Status

✅ **Completed:**
- Python script with SAM integration (`scripts/run_sam.py`)
- Command line interface with proper error handling
- JSON output format with bbox, area, and segmentation data
- Dependency checking and graceful fallbacks
- Documentation and requirements file

🔄 **Integration Options:**

### Option 1: WebSocket Server Integration (Recommended)

Since the plugin already has a WebSocket connection to a server (`ws://localhost:8080`), the SAM processing can be handled server-side:

```javascript
// In the WebSocket server (Node.js)
const { runSAMSegmentation } = require('./sam_integration');

websocket.on('message', async (message) => {
  const data = JSON.parse(message);
  
  if (data.type === 'sam_segmentation') {
    try {
      const samResults = await runSAMSegmentation(data.imagePath);
      websocket.send(JSON.stringify({
        type: 'sam_results',
        id: data.id,
        success: true,
        data: samResults
      }));
    } catch (error) {
      websocket.send(JSON.stringify({
        type: 'sam_results', 
        id: data.id,
        success: false,
        error: error.message
      }));
    }
  }
});
```

### Option 2: Direct Integration in TypeScript

For environments where Node.js child processes are available:

```typescript
// Enhanced performImageSegmentation function
async function performImageSegmentation(imageData: {
  data: Uint8Array;
  width: number;
  height: number;
}): Promise<SegmentationResult> {
  
  // Try SAM first if available
  try {
    const samResult = await runSAMSegmentation(imageData);
    if (samResult.success) {
      figma.notify('🎯 Using SAM for precise segmentation', { timeout: 2000 });
      return convertSAMToSegmentationResult(samResult);
    }
  } catch (error) {
    console.warn('SAM segmentation failed, falling back to simplified method:', error);
    figma.notify('⚠️ Using fallback segmentation method', { timeout: 2000 });
  }
  
  // Fallback to existing simplified segmentation
  return performSimplifiedSegmentation(imageData);
}

async function runSAMSegmentation(imageData: {
  data: Uint8Array;
  width: number;
  height: number;
}): Promise<any> {
  // Save image data to temporary file
  const tempImagePath = await saveImageDataToFile(imageData);
  
  // Run SAM script via child process
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const python = spawn('python3', ['scripts/run_sam.py', tempImagePath]);
    
    let output = '';
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.on('close', (code) => {
      // Clean up temp file
      require('fs').unlinkSync(tempImagePath);
      
      if (code === 0) {
        try {
          resolve(JSON.parse(output));
        } catch (e) {
          reject(new Error('Failed to parse SAM output'));
        }
      } else {
        reject(new Error(`SAM script failed with code ${code}`));
      }
    });
  });
}

function convertSAMToSegmentationResult(samResult: any): SegmentationResult {
  const { width, height } = samResult.image_dimensions;
  const segmentMap: number[][] = [];
  
  // Initialize with background (segment 0)
  for (let y = 0; y < height; y++) {
    segmentMap[y] = new Array(width).fill(0);
  }
  
  const uniqueSegments = [0]; // Background
  
  // Apply each mask from SAM
  samResult.masks.forEach((mask, index) => {
    const segmentId = index + 1;
    uniqueSegments.push(segmentId);
    
    // Convert polygon segmentation to pixel mask
    mask.segmentation.forEach(polygon => {
      fillPolygon(segmentMap, polygon, segmentId);
    });
  });
  
  return {
    segmentMap,
    uniqueSegments,
    width,
    height
  };
}
```

## Testing the Integration

1. **Install Dependencies:**
   ```bash
   pip install -r scripts/requirements.txt
   ```

2. **Download SAM Checkpoint:**
   ```bash
   wget https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth
   ```

3. **Test with Sample Image:**
   ```bash
   python3 scripts/run_sam.py test_image.jpg
   ```

## Performance Considerations

- **CPU vs GPU:** SAM runs faster with CUDA GPU support
- **Model Size:** ViT-H (default) is most accurate but largest
- **Fallback:** Always include the existing simplified segmentation as fallback
- **Caching:** Consider caching SAM results for identical images

## Error Handling

The SAM script provides structured error output:

```json
{
  "success": false,
  "error": "Missing dependencies: torch, segment-anything",
  "message": "Please install dependencies: pip install -r scripts/requirements.txt"
}
```

Common error scenarios:
- Missing Python dependencies → Fallback to simplified segmentation  
- Missing SAM checkpoint → Show download instructions
- Image processing errors → Use existing image processing pipeline

## Benefits of SAM Integration

✅ **Precise segmentation** of UI elements vs. simplified region detection  
✅ **Object-aware boundaries** that follow actual element edges  
✅ **Automatic mask generation** without manual intervention  
✅ **High-quality results** matching Meta's state-of-the-art model  
✅ **Graceful degradation** with existing fallback system  

## Next Steps

1. **Server Integration:** Add SAM processing to the WebSocket server
2. **Checkpoint Management:** Add automatic checkpoint download 
3. **Performance Optimization:** Implement result caching
4. **UI Feedback:** Enhance progress notifications for SAM processing
5. **Quality Metrics:** Add mask quality assessment and filtering