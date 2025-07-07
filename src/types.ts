// Core Figma API types
export interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface RGBA extends RGB {
  readonly a: number;
}

export interface ComponentData {
  readonly id: string;
  readonly type: 'FRAME' | 'RECTANGLE' | 'ELLIPSE' | 'TEXT' | 'VECTOR' | 'GROUP';
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fills?: SolidPaint[];
  readonly visible?: boolean;
  readonly opacity?: number;
}

export interface ColorData {
  readonly name: string;
  readonly color: RGB;
  readonly opacity: number;
  readonly usage?: 'primary' | 'secondary' | 'accent' | 'text' | 'background';
}

export interface TypographyData {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
  readonly fontFamily?: string;
  readonly fontWeight?: string;
  readonly lineHeight?: number;
  readonly letterSpacing?: number;
  readonly textAlign?: 'left' | 'center' | 'right' | 'justify';
}

export interface ImageAnalysisResult {
  readonly components: ComponentData[];
  readonly colors: ColorData[];
  readonly typography: TypographyData[];
  readonly metadata?: {
    readonly width: number;
    readonly height: number;
    readonly processingTime: number;
    readonly confidence: number;
    readonly version: string;
  };
}

export interface TextBlock {
  readonly text: string;
  readonly confidence: number;
  readonly bbox: { 
    readonly x0: number; 
    readonly y0: number; 
    readonly x1: number; 
    readonly y1: number; 
  };
  readonly language?: string;
  readonly direction?: 'ltr' | 'rtl';
}

// WebSocket message types
export interface WebSocketMessage {
  readonly type: string;
  readonly data?: unknown;
  readonly source?: string;
  readonly requestId?: string;
  readonly timestamp?: number;
}

// Plugin message types
export interface PluginMessage {
  readonly type: string;
  readonly [key: string]: unknown;
}

// Processing types
export interface ProcessingOptions {
  readonly useSegmentation?: boolean;
  readonly useOCR?: boolean;
  readonly useVectorization?: boolean;
  readonly outputFormat?: 'figma-component' | 'json' | 'svg';
  readonly quality?: 'fast' | 'balanced' | 'high';
  readonly preserveAspectRatio?: boolean;
  readonly enableColorExtraction?: boolean;
  readonly maxDimensions?: {
    readonly width: number;
    readonly height: number;
  };
}

export interface ProcessedImageData {
  readonly shapes?: ShapeData[];
  readonly textBlocks?: TextBlock[];
  readonly vectors?: VectorData[];
  readonly layout?: LayoutData;
  readonly metadata: {
    readonly width: number;
    readonly height: number;
    readonly processingTime: number;
    readonly confidence: number;
    readonly processingSteps: readonly string[];
    readonly errors?: readonly string[];
  };
}

export interface ShapeData {
  readonly type: 'rectangle' | 'ellipse' | 'polygon' | 'line' | 'path';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill?: RGB;
  readonly stroke?: RGB;
  readonly strokeWidth?: number;
  readonly cornerRadius?: number | readonly number[];
  readonly rotation?: number;
  readonly opacity?: number;
}

export interface VectorData {
  readonly paths: string;
  readonly fill?: RGB;
  readonly stroke?: RGB;
  readonly strokeWidth?: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation?: number;
  readonly opacity?: number;
}

export interface LayoutData {
  readonly type: 'vertical' | 'horizontal' | 'grid' | 'free' | 'wrap';
  readonly spacing?: number;
  readonly padding?: number | {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  readonly alignment?: 'start' | 'center' | 'end' | 'stretch';
  readonly justifyContent?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  readonly gridColumns?: number;
  readonly gridRows?: number;
}

// UI state types
export interface ConnectionStatus {
  readonly extension: boolean;
  readonly server: boolean;
  readonly lastUpdate: number;
  readonly connectionQuality?: 'excellent' | 'good' | 'poor' | 'disconnected';
  readonly latency?: number;
}

export interface ProcessingState {
  readonly stage: 'idle' | 'analyzing' | 'processing' | 'generating' | 'complete' | 'error' | 'cancelled';
  readonly progress: number;
  readonly message: string;
  readonly startTime?: number;
  readonly estimatedCompletion?: number;
  readonly currentStep?: string;
}

export interface Settings {
  readonly autoProcess: boolean;
  readonly showNotifications: boolean;
  readonly ocrLanguage: string;
  readonly qualityMode: 'fast' | 'balanced' | 'high';
  readonly websocketUrl?: string;
  readonly maxRetries?: number;
  readonly timeout?: number;
  readonly debugMode?: boolean;
}

// Error types
export interface ProcessingError {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
  readonly timestamp: number;
  readonly recoverable: boolean;
  readonly stack?: string;
}

// Response types
export interface ProcessingResponse {
  readonly success: boolean;
  readonly data?: ProcessedImageData;
  readonly error?: ProcessingError;
  readonly requestId?: string;
  readonly processingTime?: number;
  readonly cacheHit?: boolean;
}

// OCR types
export interface OCRResult {
  readonly operationId: number;
  readonly success: boolean;
  readonly result?: readonly TextBlock[];
  readonly error?: string;
  readonly confidence?: number;
  readonly processingTime?: number;
  readonly language?: string;
}

// Component generation types
export interface GenerationResult {
  readonly success: boolean;
  readonly nodeId?: string;
  readonly stats?: {
    readonly width: number;
    readonly height: number;
    readonly layerCount: number;
    readonly timestamp: string;
    readonly memoryUsage?: number;
    readonly renderTime?: number;
  };
  readonly error?: string;
  readonly warnings?: readonly string[];
}

// Export commonly used Figma types for convenience
export type SolidPaint = {
  readonly type: 'SOLID';
  readonly color: RGB;
  readonly opacity?: number;
  readonly visible?: boolean;
};

export type GradientPaint = {
  readonly type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND';
  readonly gradientStops: readonly {
    readonly color: RGBA;
    readonly position: number;
  }[];
  readonly opacity?: number;
  readonly visible?: boolean;
};

export type ImagePaint = {
  readonly type: 'IMAGE';
  readonly imageHash: string;
  readonly scaleMode: 'FILL' | 'FIT' | 'CROP' | 'TILE';
  readonly opacity?: number;
  readonly visible?: boolean;
};

export type Paint = SolidPaint | GradientPaint | ImagePaint;

export type FontName = {
  readonly family: string;
  readonly style: string;
};

export type LetterSpacing = {
  readonly value: number;
  readonly unit: 'PIXELS' | 'PERCENT';
};

export type LineHeight = {
  readonly value: number;
  readonly unit: 'PIXELS' | 'PERCENT' | 'AUTO';
};

// Utility types for better type safety
export type Dimensions = {
  readonly width: number;
  readonly height: number;
};

export type Position = {
  readonly x: number;
  readonly y: number;
};

export type BoundingBox = Position & Dimensions;

export type Transform = readonly [
  readonly [number, number, number],
  readonly [number, number, number]
];

// Event types for plugin communication
export type PluginEventType = 
  | 'generateComponentFromImage'
  | 'generateComponentFromProcessedData'
  | 'performOCR'
  | 'websocketUrl'
  | 'checkExtensionStatus'
  | 'getWebSocketUrl'
  | 'cancel'
  | 'resize'
  | 'close-websocket';

export type UIEventType =
  | 'generationComplete'
  | 'generationProgress'
  | 'ocrResult'
  | 'websocket-status-update'
  | 'extensionStatus'
  | 'error'
  | 'auto-scan-complete';

// Plugin state management
export interface PluginState {
  readonly isProcessing: boolean;
  readonly currentOperation?: string;
  readonly error?: ProcessingError;
  readonly settings: Settings;
  readonly connectionStatus: ConnectionStatus;
}

// Validation helpers
export type ValidationResult<T> = {
  readonly isValid: boolean;
  readonly data?: T;
  readonly errors: readonly string[];
};

// Performance metrics
export interface PerformanceMetrics {
  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly memoryUsage?: number;
  readonly steps: readonly {
    readonly name: string;
    readonly startTime: number;
    readonly endTime?: number;
    readonly duration?: number;
  }[];
}
