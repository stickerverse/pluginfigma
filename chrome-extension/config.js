// Configuration file for API keys
// IMPORTANT: Do NOT hardcode API keys - this is just a template
// In production, load these values from environment variables

const CONFIG = {
  // Default to empty strings - these should be filled at runtime
  // from environment variables or secure storage
  VISION_API_KEY: "", 
  FIGMA_API_KEY: ""
};

// For development - check for environment variables in local storage
// This allows testing without hardcoding keys in source
try {
  if (localStorage.getItem('VISION_API_KEY')) {
    CONFIG.VISION_API_KEY = localStorage.getItem('VISION_API_KEY');
  }
  
  if (localStorage.getItem('FIGMA_API_KEY')) {
    CONFIG.FIGMA_API_KEY = localStorage.getItem('FIGMA_API_KEY');
  }
} catch (e) {
  console.warn('Unable to load keys from local storage');
}

// Make config available globally
window.CONFIG = CONFIG;
