// Production configuration for Canvas Weaver
export interface Config {
  websocketUrl: string;
  isDevelopment: boolean;
  enableLogging: boolean;
  corsOrigins: string[];
  maxRetries: number;
  timeoutMs: number;
}

// Environment-based configuration
const getConfig = (): Config => {
  // Check if we're in development (you can also use process.env if available)
  // Figma plugins don't have access to window, so default to development mode
  const isDev = true;
  
  return {
    websocketUrl: isDev ? 'ws://localhost:8082' : 'wss://api.canvasweaver.com/ws',
    isDevelopment: isDev,
    enableLogging: isDev,
    corsOrigins: isDev 
      ? ['http://localhost:3000', 'https://www.figma.com']
      : ['https://www.figma.com', 'chrome-extension://PRODUCTION_EXTENSION_ID'],
    maxRetries: 3,
    timeoutMs: 30000
  };
};

export const config = getConfig();

// Production-ready logger
export class Logger {
  private static enabled = config.enableLogging;
  
  static log(message: string, ...args: any[]) {
    if (this.enabled) {
      console.log(`[Canvas Weaver] ${message}`, ...args);
    }
  }
  
  static error(message: string, error?: any) {
    // Always log errors, even in production
    console.error(`[Canvas Weaver] ERROR: ${message}`, error);
    
    // In production, you could send to error tracking service here
    // this.sendToErrorTracking(message, error);
  }
  
  static warn(message: string, ...args: any[]) {
    if (this.enabled) {
      console.warn(`[Canvas Weaver] WARNING: ${message}`, ...args);
    }
  }
  
  // Future: Integration with error tracking services
  private static sendToErrorTracking(message: string, error: any) {
    // Integration with Sentry, LogRocket, etc.
    // Sentry.captureException(error, { extra: { message } });
  }
}