/**
 * Sticker Unified Component System - Core Module
 * Shared functionality between Chrome extension and Figma plugin
 */

// Environment detection
const ENV = {
  CHROME: typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id,
  FIGMA: typeof figma !== 'undefined'
};

// Unified configuration system
const CONFIG = {
  version: '1.0.0',
  name: 'Sticker Component Analyzer',
  apiEndpoints: {
    vision: 'http://localhost:3001/api/analyze',
    // Add any other API endpoints here
  },
  
  // Load environment-specific configuration
  initialize() {
    if (ENV.CHROME) {
      // Chrome extension specific initialization
      this.storageKey = 'sticker_config';
      this.loadFromChromeStorage();
    } else if (ENV.FIGMA) {
      // Figma plugin specific initialization
      this.storageKey = 'sticker_figma_config';
      this.loadFromFigmaClientStorage();
    }
    return this;
  },
  
  // Get a configuration value with optional default
  get(key, defaultValue) {
    return this[key] !== undefined ? this[key] : defaultValue;
  },
  
  // Set a configuration value and save it
  set(key, value) {
    this[key] = value;
    this.save();
    return value;
  },
  
  // Save configuration based on environment
  save() {
    if (ENV.CHROME && chrome.storage) {
      chrome.storage.local.set({ [this.storageKey]: this });
    } else if (ENV.FIGMA) {
      try {
        const serialized = JSON.stringify(this);
        figma.clientStorage.setAsync(this.storageKey, serialized);
      } catch (e) {
        console.error('Failed to save Figma configuration:', e);
      }
    }
  },
  
  // Load configuration based on environment
  loadFromChromeStorage() {
    if (chrome.storage) {
      chrome.storage.local.get(this.storageKey, (result) => {
        if (result[this.storageKey]) {
          Object.assign(this, result[this.storageKey]);
        }
      });
    }
  },
  
  async loadFromFigmaClientStorage() {
    try {
      const stored = await figma.clientStorage.getAsync(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.assign(this, parsed);
      }
    } catch (e) {
      console.error('Failed to load Figma configuration:', e);
    }
  }
};

// Shared messaging system
const Messenger = {
  callbacks: {},
  
  // Register a callback for a specific message type
  on(type, callback) {
    if (!this.callbacks[type]) {
      this.callbacks[type] = [];
    }
    this.callbacks[type].push(callback);
    return this;
  },
  
  // Remove a callback
  off(type, callback) {
    if (this.callbacks[type]) {
      this.callbacks[type] = this.callbacks[type].filter(cb => cb !== callback);
    }
    return this;
  },
  
  // Send a message (environment specific implementation)
  send(type, data = {}) {
    const message = { type, data, source: 'sticker-system' };
    
    if (ENV.CHROME) {
      // If in Chrome extension, try to find Figma tabs
      if (chrome.tabs) {
        chrome.tabs.query({ url: '*://*.figma.com/*' }, (tabs) => {
          if (tabs && tabs.length > 0) {
            tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, message);
            });
          }
        });
      }
    } else if (ENV.FIGMA) {
      // If in Figma plugin, send to UI
      figma.ui.postMessage(message);
    }
    
    // Also trigger local callbacks
    this._trigger(type, data);
    
    return this;
  },
  
  // Initialize environment-specific listeners
  initialize() {
    if (ENV.CHROME) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message && message.type && message.source === 'sticker-system') {
          this._trigger(message.type, message.data);
          sendResponse({ success: true });
        }
        return true;
      });
    } else if (ENV.FIGMA) {
      figma.ui.onmessage = (message) => {
        if (message && message.type) {
          this._trigger(message.type, message.data);
        }
      };
    }
    
    // Also listen for window messages in both environments
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message && message.type && message.source === 'sticker-system') {
        this._trigger(message.type, message.data);
      }
    });
    
    return this;
  },
  
  // Internal method to trigger callbacks
  _trigger(type, data) {
    if (this.callbacks[type]) {
      this.callbacks[type].forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`Error in ${type} handler:`, e);
        }
      });
    }
  }
};

// Unified image analysis system
const ImageAnalyzer = {
  // Analyze image with Google Vision API
  async analyzeImage(imageData, apiKey) {
    try {
      const endpoint = CONFIG.get('apiEndpoints').vision;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          image: imageData,
          apiKey: apiKey
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      return this.processVisionResponse(result, imageData);
    } catch (error) {
      console.error('Image analysis error:', error);
      throw error;
    }
  },
  
  // Process Vision API response to standardized format
  processVisionResponse(response, originalImage) {
    const results = {
      components: [],
      colors: [],
      typography: [],
      originalImage
    };
    
    if (!response.responses || !response.responses[0]) {
      return results;
    }
    
    const firstResult = response.responses[0];
    
    // Extract colors from image properties
    if (firstResult.imagePropertiesAnnotation && 
        firstResult.imagePropertiesAnnotation.dominantColors) {
      
      firstResult.imagePropertiesAnnotation.dominantColors.colors.forEach((color, index) => {
        results.colors.push({
          name: `Color ${index + 1}`,
          r: color.color.red / 255,
          g: color.color.green / 255,
          b: color.color.blue / 255,
          opacity: color.color.alpha || 1
        });
      });
    }
    
    // Extract text from text annotations
    if (firstResult.textAnnotations && firstResult.textAnnotations.length > 0) {
      firstResult.textAnnotations.slice(1).forEach((text, index) => {
        if (!text.boundingPoly || !text.boundingPoly.vertices) {
          return;
        }
        
        // Calculate position and size
        const vertices = text.boundingPoly.vertices;
        const x = Math.min(...vertices.map(v => v.x || 0));
        const y = Math.min(...vertices.map(v => v.y || 0));
        const width = Math.max(...vertices.map(v => v.x || 0)) - x;
        const height = Math.max(...vertices.map(v => v.y || 0)) - y;
        
        results.typography.push({
          text: text.description,
          fontSize: this.estimateFontSize(height),
          x: x,
          y: y,
          width: width,
          height: height
        });
      });
    }
    
    // Extract components from object localization
    if (firstResult.localizedObjectAnnotations) {
      firstResult.localizedObjectAnnotations.forEach((object, index) => {
        if (!object.boundingPoly || !object.boundingPoly.normalizedVertices) {
          return;
        }
        
        const vertices = object.boundingPoly.normalizedVertices;
        
        // Calculate normalized coordinates
        const nx = Math.min(...vertices.map(v => v.x || 0));
        const ny = Math.min(...vertices.map(v => v.y || 0));
        const nWidth = Math.max(...vertices.map(v => v.x || 0)) - nx;
        const nHeight = Math.max(...vertices.map(v => v.y || 0)) - ny;
        
        // Determine component type based on object name
        let type = 'RECTANGLE';
        if (object.name.toLowerCase().includes('button')) {
          type = 'BUTTON';
        } else if (object.name.toLowerCase().includes('text')) {
          type = 'TEXT';
        }
        
        results.components.push({
          id: `component-${index}`,
          name: object.name,
          type: type,
          x: nx * 100, // Convert to percentage
          y: ny * 100,
          width: nWidth * 100,
          height: nHeight * 100,
          confidence: object.score
        });
      });
    }
    
    return results;
  },
  
  // Utility to estimate font size based on height
  estimateFontSize(height) {
    if (height <= 0) return 12;
    return Math.max(Math.round(height * 0.75), 8);
  }
};

// Export shared systems
const SharedCore = {
  ENV,
  CONFIG: CONFIG.initialize(),
  Messenger: Messenger.initialize(),
  ImageAnalyzer,
  
  // Helper methods
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]); // Remove data URL prefix
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
};

// Export based on environment
if (typeof module !== 'undefined') {
  module.exports = SharedCore;
} else {
  window.StickerCore = SharedCore;
}
