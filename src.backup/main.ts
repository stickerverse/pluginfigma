export * from './types';
figma.showUI(__html__, { 
  width: 400, 
  height: 600,
  title: "Stickerverse Plugin"
});

figma.ui.onmessage = msg => {
  if (msg.type === 'close' || msg.type === 'CLOSE_PLUGIN') {
    figma.closePlugin();
  }
  
  if (msg.type === 'IMAGE_ANALYSIS_COMPLETE') {
    figma.notify('Image analysis complete!');
    
    // Create a simple frame with the results
    const frame = figma.createFrame();
    frame.name = "Analyzed Component";
    frame.x = 0;
    frame.y = 0;
    frame.resize(400, 300);
    
    // Set background
    frame.fills = [{
      type: 'SOLID',
      color: { r: 0.95, g: 0.95, b: 0.95 }
    }];
    
    figma.currentPage.appendChild(frame);
    figma.currentPage.selection = [frame];
    figma.viewport.scrollAndZoomIntoView([frame]);
  }
};
