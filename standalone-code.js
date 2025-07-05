// Minimal Figma Plugin Code
// Shows UI and creates a rectangle when button is clicked

// Show the UI
figma.showUI(__html__, { width: 400, height: 300, title: 'Minimal Plugin' });

// Notify that plugin is ready
figma.notify('Minimal plugin loaded successfully!', { timeout: 2000 });

// Listen for messages from the UI
figma.ui.onmessage = async (msg) => {
  console.log('Plugin received message:', msg);
  
  if (msg.type === 'create-rectangle') {
    // Create a rectangle
    const rect = figma.createRectangle();
    rect.x = 100;
    rect.y = 100;
    rect.resize(200, 100);
    
    // Set a blue fill
    rect.fills = [{
      type: 'SOLID',
      color: { r: 0.2, g: 0.4, b: 1.0 }
    }];
    
    // Add to current page
    figma.currentPage.appendChild(rect);
    
    // Select the rectangle
    figma.currentPage.selection = [rect];
    
    // Zoom to fit
    figma.viewport.scrollAndZoomIntoView([rect]);
    
    // Notify success
    figma.notify('Rectangle created successfully!', { timeout: 2000 });
    
    // Send confirmation back to UI
    figma.ui.postMessage({
      type: 'rectangle-created',
      success: true,
      message: 'Rectangle created at position (100, 100)'
    });
  }
  
  if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};

// Send initial message to UI
figma.ui.postMessage({
  type: 'plugin-ready',
  message: 'Plugin is ready to create rectangles!'
});