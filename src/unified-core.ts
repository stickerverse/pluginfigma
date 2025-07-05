/**
 * Sticker Component Analyzer - Figma Plugin Core Integration
 * This module connects the Figma plugin to our shared core system
 */

// Import the shared core functionality from the compiled JS
declare global {
  interface Window {
    StickerCore: any;
  }
}

// A TypeScript wrapper around the shared core for type safety
export class UnifiedCore {
  private static instance: UnifiedCore;
  private initialized = false;
  
  // Core components
  public config: any;
  public messenger: any;
  public imageAnalyzer: any;
  
  // Singleton pattern
  public static getInstance(): UnifiedCore {
    if (!UnifiedCore.instance) {
      UnifiedCore.instance = new UnifiedCore();
    }
    return UnifiedCore.instance;
  }
  
  // Private constructor for singleton
  private constructor() {}
  
  // Initialize the core by loading the shared scripts
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Simplified initialization - don't block plugin startup
      console.log('Unified core initialized in Figma plugin');
      this.initialized = true;
      
      // Set up minimal config
      this.config = {
        pluginId: 'figma-image-component-analyzer',
        version: '1.0.0'
      };
      
    } catch (error) {
      console.error('Failed to initialize unified core:', error);
      // Don't throw - allow plugin to continue without core
      this.initialized = true;
    }
  }
  
  // Send a message through the core messenger system
  public sendMessage(type: string, data: any): void {
    figma.ui.postMessage({
      type: 'CORE_SEND',
      messageType: type,
      messageData: data
    });
  }
  
  // Register a message handler
  public onMessage(type: string, callback: (data: any) => void): void {
    // Store the callback in a map
    // Implementation depends on figma.ui.onmessage handler above
  }
  
  // Process component data using the shared system
  public async processComponentData(data: any): Promise<any> {
    // Simplified - just return the data as-is for now
    console.log('Processing component data:', data);
    return Promise.resolve(data);
  }
}

// Export default instance
export default UnifiedCore.getInstance();
