/**
 * Simplified utilities to replace @create-figma-plugin/utilities functionality
 */

/**
 * Simple implementation of emit to replace the one from @create-figma-plugin/utilities
 * @param eventName The name of the event to emit
 * @param data The data to send with the event
 */
export function emit<T extends Record<string, any>>(
  eventName: string,
  data?: any
): void {
  // For UI -> Plugin communication
  if (typeof window !== 'undefined') {
    parent.postMessage(
      {
        pluginMessage: {
          type: eventName,
          ...data
        }
      },
      '*'
    );
  } 
  // For Plugin -> UI communication
  else if (typeof figma !== 'undefined') {
    figma.ui.postMessage({
      type: eventName,
      ...data
    });
  }
}

/**
 * Shows the plugin UI
 * @param options Options for showing the UI
 */
export function showUI(options: { 
  width?: number; 
  height?: number;
  title?: string;
}): void {
  if (typeof figma !== 'undefined') {
    figma.showUI(__html__, {
      width: options.width || 350,
      height: options.height || 500,
      title: options.title || 'Figma Plugin'
    });
  }
}

/**
 * Register a handler for a one-time event
 * @param eventName The name of the event to listen for
 * @param handler The handler function to call when the event is received
 */
export function once<T extends { name: string; handler: (data: any) => any }>(
  eventName: T['name'], 
  handler: T['handler']
): void {
  if (typeof figma !== 'undefined') {
    // Type assertion to handle Figma's strict typing requirements
    figma.ui.once('message', (data) => {
      // Check if the message type matches our expected event name
      if (data && data.type === eventName) {
        handler(data);
      }
    });
  } else if (typeof window !== 'undefined') {
    const listener = (event: MessageEvent) => {
      const { type, ...data } = event.data.pluginMessage || {};
      if (type === eventName) {
        handler(data);
        window.removeEventListener('message', listener);
      }
    };
    window.addEventListener('message', listener);
  }
}
