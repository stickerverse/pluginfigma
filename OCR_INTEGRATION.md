# Tesseract.js OCR Integration

This document describes the implementation of Tesseract.js OCR integration in the Canvas Weaver Figma plugin.

## Overview

The integration provides real OCR text recognition capabilities using Tesseract.js, replacing the previous placeholder implementation with actual text extraction from images.

## Architecture

Due to Figma's plugin sandboxing constraints, the OCR functionality is split between two environments:

### Main Plugin (src/code.ts)
- Handles image data processing
- Coordinates with UI for OCR operations
- Manages async OCR operations with unique IDs
- Provides fallback text detection for errors

### UI Environment (src/ui.tsx)
- Initializes and manages Tesseract.js worker
- Performs actual OCR operations
- Handles image processing and text recognition
- Returns structured results to main plugin

## Key Features

### 1. Tesseract.js Worker Initialization
- Automatic worker initialization on UI load
- Error handling and retry mechanisms
- User feedback during initialization

### 2. Image Processing Pipeline
```
Uint8Array → base64 → Tesseract.js → TextBlock[]
```

### 3. Text Recognition Optimization
- Confidence-based filtering (>30% confidence)
- Nearby text block merging for coherent results
- Bounding box coordinate extraction
- Progressive loading feedback

### 4. Error Handling
- Graceful fallback to heuristic text detection
- Timeout handling (30 seconds)
- User notifications for errors
- Worker cleanup on plugin close

## API Integration

### performOCR Function
```typescript
async function performOCR(imageData: {
  data: Uint8Array;
  width: number;
  height: number;
}): Promise<TextBlock[]>
```

### TextBlock Interface
```typescript
interface TextBlock {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}
```

## Message Passing Protocol

### OCR Request (Main → UI)
```typescript
{
  type: 'performOCR',
  operationId: number,
  imageData: {
    base64: string,
    width: number,
    height: number
  }
}
```

### OCR Response (UI → Main)
```typescript
{
  type: 'ocrResult',
  operationId: number,
  success: boolean,
  result?: TextBlock[],
  error?: string
}
```

## Performance Optimizations

1. **Worker Persistence**: Single Tesseract worker instance reused across operations
2. **Confidence Filtering**: Removes low-quality text recognition results
3. **Text Merging**: Combines nearby words into coherent text blocks
4. **Progress Feedback**: Real-time progress updates during OCR
5. **Timeout Protection**: Prevents hanging operations

## Dependencies

- `tesseract.js ^4.1.1`: Core OCR functionality
- `preact ^10.19.3`: UI framework for worker management
- `@create-figma-plugin/ui ^2.5.0`: Figma UI components

## Usage

The OCR integration is automatically used when the `performOCR` function is called during component analysis. No manual configuration is required.

## Error Scenarios

1. **Worker Initialization Failure**: Falls back to heuristic text detection
2. **OCR Processing Error**: Returns empty array with error notification
3. **Timeout**: Cancels operation after 30 seconds
4. **Network Issues**: Handles Tesseract.js CDN loading failures

## Future Improvements

1. **Language Support**: Add support for multiple languages
2. **OCR Settings**: Configurable confidence thresholds
3. **Caching**: Cache OCR results for repeated images
4. **Performance**: Web Worker optimization for large images
5. **Accuracy**: Custom training data for UI-specific text