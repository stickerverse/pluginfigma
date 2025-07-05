import { API_CONFIG } from '../config';
import { ImageAnalysisResult } from '../types';

/**
 * Service for interacting with Google Cloud Vision API
 */
export class VisionApiService {
  private apiKey: string;

  constructor(apiKey: string = API_CONFIG.GOOGLE_CLOUD_VISION_API_KEY) {
    this.apiKey = apiKey;
  }

  /**
   * Analyze an image using Google Cloud Vision API through our proxy server
   * @param imageBase64 Base64-encoded image data
   */
  async analyzeImage(imageBase64: string): Promise<ImageAnalysisResult> {
    try {
      // Extract the base64 content (remove data URL prefix if present)
      const base64Content = imageBase64.includes(',') ? 
        imageBase64.split(',')[1] : imageBase64;
        
      // Configure the API proxy URL - use server deployed URL in production
      const PROXY_API_URL = 'http://localhost:3001/api/analyze';
      
      // Send request to our proxy server instead of directly to Google
      const response = await fetch(PROXY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: base64Content,
          apiKey: this.apiKey // Send API key for server-side validation
        })
      });
      
      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || `API error: ${response.status}`);
        } catch (e) {
          // If error response is not JSON
          const errorText = await response.text();
          throw new Error(`API proxy server error (${response.status}): ${errorText || 'Unknown error'}`);
        }
      }

      const data = await response.json();
      
      // Process the API response into our standard format
      return this.processVisionResponse(data, 'uploaded-image');
    } catch (error) {
      console.error('Vision API error:', error);
      throw error;
    }
  }

  /**
   * Process the Vision API response into a format usable by Figma
   * @param response The raw Vision API response
   * @param imageName Name of the analyzed image
   */
  private processVisionResponse(response: any, imageName: string): ImageAnalysisResult {
    const result: ImageAnalysisResult = {
      components: [],
      colors: [],
      typography: []
    };

    if (!response.responses || response.responses.length === 0) {
      return result;
    }

    const apiResponse = response.responses[0];
    
    // Extract colors
    if (apiResponse.imagePropertiesAnnotation?.dominantColors?.colors) {
      const colors = apiResponse.imagePropertiesAnnotation.dominantColors.colors;
      result.colors = colors.map((color: any, index: number) => ({
        name: `Color ${index + 1}`,
        color: {
          r: color.color.red / 255,
          g: color.color.green / 255,
          b: color.color.blue / 255
        },
        opacity: color.score
      }));
    }

    // Extract text elements
    if (apiResponse.textAnnotations && apiResponse.textAnnotations.length > 0) {
      // Skip the first item as it's the entire text
      const textAnnotations = apiResponse.textAnnotations.slice(1);
      
      result.typography = textAnnotations.map((text: any, index: number) => {
        // Calculate bounding box
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
        if (text.boundingPoly?.vertices) {
          for (const vertex of text.boundingPoly.vertices) {
            minX = Math.min(minX, vertex.x || 0);
            minY = Math.min(minY, vertex.y || 0);
            maxX = Math.max(maxX, vertex.x || 0);
            maxY = Math.max(maxY, vertex.y || 0);
          }
        }

        return {
          text: text.description,
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          fontSize: Math.round((maxY - minY) * 0.7) // Estimate font size
        };
      });
    }

    // Extract UI components from objects
    if (apiResponse.localizedObjectAnnotations) {
      apiResponse.localizedObjectAnnotations.forEach((obj: any, index: number) => {
        if (obj.boundingPoly?.normalizedVertices) {
          // Calculate actual pixels from normalized coordinates (0-1)
          const vertices = obj.boundingPoly.normalizedVertices;
          
          // Assuming image dimensions from the preview element
          // This is an estimate, ideally we'd get actual image dimensions
          const imgWidth = 800; // placeholder
          const imgHeight = 600; // placeholder
          
          // Calculate bounding box
          let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
          for (const vertex of vertices) {
            minX = Math.min(minX, (vertex.x || 0) * imgWidth);
            minY = Math.min(minY, (vertex.y || 0) * imgHeight);
            maxX = Math.max(maxX, (vertex.x || 0) * imgWidth);
            maxY = Math.max(maxY, (vertex.y || 0) * imgHeight);
          }
          
          // Determine type based on object name and ratio
          const width = maxX - minX;
          const height = maxY - minY;
          const ratio = width / height;
          let type = 'RECTANGLE';
          
          // If it's close to a square or circle
          if (ratio > 0.9 && ratio < 1.1) {
            type = 'ELLIPSE';
          }
          
          // If object name contains button or input, use those types
          const objName = obj.name.toLowerCase();
          if (objName.includes('button')) {
            type = 'RECTANGLE'; // Buttons are usually rectangles
          } else if (objName.includes('input')) {
            type = 'RECTANGLE'; // Input fields are usually rectangles
          }
          
          result.components.push({
            id: `component-${index}`,
            type,
            name: obj.name || `Component ${index + 1}`,
            x: minX,
            y: minY,
            width,
            height,
            fills: [
              {
                type: 'SOLID',
                color: result.colors.length > 0 ? 
                  result.colors[0].color : 
                  { r: 0.9, g: 0.9, b: 0.9 },
                opacity: 1
              }
            ]
          });
        }
      });
    }

    // If no objects detected, try to identify UI elements using image analysis
    if (result.components.length === 0) {
      this.identifyUIComponents(apiResponse, result);
    }

    return result;
  }

  /**
   * Try to identify UI components based on image analysis
   * This uses heuristics when explicit object detection fails
   * @param apiResponse The Vision API response
   * @param result The result object to populate
   */
  private identifyUIComponents(apiResponse: any, result: ImageAnalysisResult): void {
    // Use text detection to identify potential UI elements
    if (apiResponse.textAnnotations && apiResponse.textAnnotations.length > 0) {
      const textAnnotations = apiResponse.textAnnotations.slice(1);
      
      // Group nearby text elements as potential UI components
      const groups: any[] = [];
      const assigned = new Set<number>();
      
      // Find potential buttons (often have short text and are isolated)
      textAnnotations.forEach((text: any, index: number) => {
        if (assigned.has(index)) return;
        
        const content = text.description.toLowerCase();
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
        
        if (text.boundingPoly?.vertices) {
          for (const vertex of text.boundingPoly.vertices) {
            minX = Math.min(minX, vertex.x || 0);
            minY = Math.min(minY, vertex.y || 0);
            maxX = Math.max(maxX, vertex.x || 0);
            maxY = Math.max(maxY, vertex.y || 0);
          }
        }
        
        // Check if text looks like a button label
        const isButtonLike = 
          content.length < 15 && 
          (content.includes('button') || 
           content.includes('submit') || 
           content.includes('cancel') || 
           content.includes('ok') ||
           content.includes('sign') ||
           content.includes('log'));
        
        if (isButtonLike) {
          const padding = 16;
          result.components.push({
            id: `button-${index}`,
            type: 'RECTANGLE',
            name: `Button: ${text.description}`,
            x: minX - padding,
            y: minY - padding,
            width: (maxX - minX) + (padding * 2),
            height: (maxY - minY) + (padding * 2),
            fills: [
              {
                type: 'SOLID',
                color: result.colors.length > 0 ? 
                  result.colors[0].color : 
                  { r: 0.2, g: 0.5, b: 0.9 },
                opacity: 1
              }
            ]
          });
          assigned.add(index);
        }
      });
      
      // Create a main component as a container
      if (result.components.length === 0) {
        result.components.push({
          id: 'main-container',
          type: 'FRAME',
          name: 'Main Component',
          x: 0,
          y: 0,
          width: 800, // placeholder
          height: 600, // placeholder
          fills: [
            {
              type: 'SOLID',
              color: { r: 1, g: 1, b: 1 },
              opacity: 1
            }
          ]
        });
      }
    }
  }
}
