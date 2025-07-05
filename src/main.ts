import { on, showUI } from '@create-figma-plugin/utilities'

// Type definitions for use across the plugin
export interface ColorData {
  name: string;
  color: { r: number; g: number; b: number };
  opacity?: number;
}

export interface TypographyData {
  text: string;
  fontSize: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: {
    family: string;
    style: string;
  };
}

export interface ComponentData {
  id?: string;
  name: string;
  type?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fills?: any[];
  strokes?: any[];
  effects?: any[];
  children?: ComponentData[];
  properties?: Record<string, any>;
}

export interface ImageAnalysisResult {
  colors: ColorData[];
  typography: TypographyData[];
  components: ComponentData[];
}

export default function () {
  showUI({
    width: 400,
    height: 600,
    title: "Stickerverse Plugin"
  })

  // Handle messages from the UI
  on('CLOSE_PLUGIN', function() {
    figma.closePlugin()
  })
  
  on('close', function() {
    figma.closePlugin()
  })
  
  on('IMAGE_ANALYSIS_COMPLETE', function(data) {
    figma.notify('Image analysis complete!')
    
    // Create a simple frame with the results
    const frame = figma.createFrame()
    frame.name = "Analyzed Component"
    frame.x = 0
    frame.y = 0
    frame.resize(400, 300)
    
    // Set background
    frame.fills = [{
      type: 'SOLID',
      color: { r: 0.95, g: 0.95, b: 0.95 }
    }]
    
    figma.currentPage.appendChild(frame)
    figma.currentPage.selection = [frame]
    figma.viewport.scrollAndZoomIntoView([frame])
  })
}
