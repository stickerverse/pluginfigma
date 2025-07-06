// Import type definitions for our libraries
declare const figma: PluginAPI;

// Show UI
figma.showUI(__html__, { width: 400, height: 600 });

// Helper function to convert base64 to Uint8Array
async function base64ToUint8Array(base64: string): Promise<Uint8Array> {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
  
  // Convert base64 to binary string
  const binaryString = atob(base64Data);
  
  // Create Uint8Array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
}

// Helper function to extract dominant color from image region
function extractDominantColor(imageData: ImageData, x: number, y: number, width: number, height: number): RGB {
  let r = 0, g = 0, b = 0;
  let pixelCount = 0;
  
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const px = x + dx;
      const py = y + dy;
      
      if (px >= 0 && px < imageData.width && py >= 0 && py < imageData.height) {
        const index = (py * imageData.width + px) * 4;
        r += imageData.data[index];
        g += imageData.data[index + 1];
        b += imageData.data[index + 2];
        pixelCount++;
      }
    }
  }
  
  if (pixelCount > 0) {
    r = r / pixelCount / 255;
    g = g / pixelCount / 255;
    b = b / pixelCount / 255;
  }
  
  return { r, g, b };
}

// Simplified segmentation function (since we can't use TensorFlow in Figma)
async function segmentImage(imageData: ImageData): Promise<Array<{x: number, y: number, width: number, height: number, type: 'shape' | 'text'}>> {
  // This is a simplified version. In production, you'd want more sophisticated edge detection
  const segments: Array<{x: number, y: number, width: number, height: number, type: 'shape' | 'text'}> = [];
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  // Simple edge detection to find rectangular regions
  const visited = new Set<string>();
  
  for (let y = 0; y < height; y += 5) {
    for (let x = 0; x < width; x += 5) {
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      
      if (alpha > 128) { // Non-transparent pixel
        // Find bounds of this region
        let minX = x, maxX = x;
        let minY = y, maxY = y;
        
        // Expand to find connected region
        const queue = [[x, y]];
        const regionColor = { r: data[index], g: data[index + 1], b: data[index + 2] };
        
        while (queue.length > 0) {
          const [cx, cy] = queue.shift()!;
          const ckey = `${cx},${cy}`;
          
          if (visited.has(ckey)) continue;
          visited.add(ckey);
          
          const cidx = (cy * width + cx) * 4;
          const calpha = data[cidx + 3];
          
          if (calpha > 128) {
            // Check if color is similar
            const colorDiff = Math.abs(data[cidx] - regionColor.r) + 
                            Math.abs(data[cidx + 1] - regionColor.g) + 
                            Math.abs(data[cidx + 2] - regionColor.b);
            
            if (colorDiff < 100) {
              minX = Math.min(minX, cx);
              maxX = Math.max(maxX, cx);
              minY = Math.min(minY, cy);
              maxY = Math.max(maxY, cy);
              
              // Add neighbors
              if (cx > 0) queue.push([cx - 5, cy]);
              if (cx < width - 1) queue.push([cx + 5, cy]);
              if (cy > 0) queue.push([cx, cy - 5]);
              if (cy < height - 1) queue.push([cx, cy + 5]);
            }
          }
        }
        
        // Add segment if it's significant
        const segWidth = maxX - minX;
        const segHeight = maxY - minY;
        
        if (segWidth > 20 && segHeight > 20) {
          // Heuristic: tall and narrow regions might be text
          const aspectRatio = segWidth / segHeight;
          const type = (aspectRatio > 2 || aspectRatio < 0.5) && segHeight < 50 ? 'text' : 'shape';
          
          segments.push({
            x: minX,
            y: minY,
            width: segWidth,
            height: segHeight,
            type
          });
        }
      }
    }
  }
  
  return segments;
}

// Main component analysis and generation function
async function analyzeAndBuildComponent(base64: string): Promise<FrameNode> {
  figma.notify('Analyzing component structure...', { timeout: 2000 });
  
  try {
    // Create the main container frame
    const componentFrame = figma.createFrame();
    componentFrame.name = 'Generated Component';
    componentFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    
    // Convert base64 to image data
    const imageBytes = await base64ToUint8Array(base64);
    
    // Create a temporary image node to get dimensions and work with the image
    const tempImage = figma.createImage(imageBytes);
    const imageNode = figma.createRectangle();
    
    const imagePaint: ImagePaint = {
      type: 'IMAGE',
      imageHash: tempImage.hash,
      scaleMode: 'FILL'
    };
    
    imageNode.fills = [imagePaint];
    
    // Wait for image to load and get dimensions
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get image dimensions from the paint
    const { width: imgWidth, height: imgHeight } = await figma.getImageByHash(tempImage.hash)!.getSizeAsync();
    
    componentFrame.resize(imgWidth, imgHeight);
    imageNode.resize(imgWidth, imgHeight);
    
    // For now, we'll create a simplified version with the image as background
    // and attempt to extract some basic shapes
    
    // Add the image as a background layer
    imageNode.name = 'Background Image';
    imageNode.opacity = 0.3; // Make it semi-transparent to see generated shapes
    componentFrame.appendChild(imageNode);
    
    // Create some sample shapes based on common patterns
    // In a real implementation, this would use the segmentation logic
    
    // Example: Create a button-like shape if the component looks like a button
    if (imgWidth > imgHeight * 2) { // Wide rectangle, might be a button
      const buttonBg = figma.createRectangle();
      buttonBg.name = 'Button Background';
      buttonBg.resize(imgWidth * 0.9, imgHeight * 0.8);
      buttonBg.x = imgWidth * 0.05;
      buttonBg.y = imgHeight * 0.1;
      buttonBg.cornerRadius = Math.min(imgHeight * 0.2, 8);
      buttonBg.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.6, b: 1 } }];
      componentFrame.appendChild(buttonBg);
      
      // Add text
      const buttonText = figma.createText();
      buttonText.name = 'Button Text';
      buttonText.characters = 'Button';
      buttonText.fontSize = imgHeight * 0.4;
      buttonText.textAlignHorizontal = 'CENTER';
      buttonText.textAlignVertical = 'CENTER';
      buttonText.resize(imgWidth * 0.8, imgHeight * 0.6);
      buttonText.x = imgWidth * 0.1;
      buttonText.y = imgHeight * 0.2;
      componentFrame.appendChild(buttonText);
    }
    
    // Apply auto layout
    componentFrame.layoutMode = 'VERTICAL';
    componentFrame.primaryAxisAlignItems = 'CENTER';
    componentFrame.counterAxisAlignItems = 'CENTER';
    componentFrame.paddingLeft = 20;
    componentFrame.paddingRight = 20;
    componentFrame.paddingTop = 20;
    componentFrame.paddingBottom = 20;
    componentFrame.itemSpacing = 10;
    
    figma.notify('Component generation complete!', { timeout: 2000 });
    
    return componentFrame;
  } catch (error) {
    console.error('Error generating component:', error);
    figma.notify('Error generating component. Check console for details.', { timeout: 5000 });
    throw error;
  }
}

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  console.log('Received message:', msg);
  
  if (msg.type === 'generateComponentFromImage') {
    try {
      figma.notify('Received component data. Analyzing...', { timeout: 3000 });
      
      // Generate the component
      const componentFrame = await analyzeAndBuildComponent(msg.base64);
      
      // Place it in the center of the viewport
      const viewport = figma.viewport.center;
      componentFrame.x = viewport.x - componentFrame.width / 2;
      componentFrame.y = viewport.y - componentFrame.height / 2;
      
      // Select the new component
      figma.currentPage.selection = [componentFrame];
      
      // Zoom to fit
      figma.viewport.scrollAndZoomIntoView([componentFrame]);
      
      figma.notify('Component generated successfully!', { timeout: 3000 });
      
      // Send success message back to UI
      figma.ui.postMessage({
        type: 'generationComplete',
        success: true
      });
    } catch (error) {
      console.error('Error in generation:', error);
      figma.notify('Failed to generate component', { timeout: 5000 });
      
      figma.ui.postMessage({
        type: 'generationComplete',
        success: false,
        error: error.message
      });
    }
  }
};

// Clean up on close
figma.on('close', () => {
  // Any cleanup needed
});