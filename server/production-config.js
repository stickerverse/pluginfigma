// Production configuration for Canvas Weaver Server
const isDevelopment = process.env.NODE_ENV !== 'production';

const config = {
  isDevelopment,
  
  // Server configuration
  websocketPort: process.env.WS_PORT || 8082,
  httpPort: process.env.HTTP_PORT || 3001,
  
  // CORS configuration
  corsOrigins: isDevelopment ? [
    'http://localhost:3000',
    'https://www.figma.com',
    'chrome-extension://*'
  ] : [
    'https://www.figma.com',
    'chrome-extension://YOUR_PRODUCTION_EXTENSION_ID'
  ],
  
  // Security settings
  enableLogging: isDevelopment,
  maxPayloadSize: '50mb',
  heartbeatInterval: 30000,
  
  // API configuration
  maxRetries: 3,
  timeoutMs: 30000
};

// Production-ready logger for server
class ServerLogger {
  static log(message, ...args) {
    if (config.enableLogging) {
      console.log(`[Canvas Weaver Server] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }
  
  static error(message, error) {
    console.error(`[Canvas Weaver Server] ERROR ${new Date().toISOString()} - ${message}`, error);
    
    // In production, send to monitoring service
    if (!config.isDevelopment) {
      // this.sendToMonitoring(message, error);
    }
  }
  
  static warn(message, ...args) {
    if (config.enableLogging) {
      console.warn(`[Canvas Weaver Server] WARNING ${new Date().toISOString()} - ${message}`, ...args);
    }
  }
  
  static info(message, ...args) {
    console.info(`[Canvas Weaver Server] INFO ${new Date().toISOString()} - ${message}`, ...args);
  }
}

module.exports = { config, ServerLogger };