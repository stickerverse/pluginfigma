// Advanced image processing utilities for better component generation

interface ProcessedSegment {
  bounds: { x: number; y: number; width: number; height: number };
  type: 'rectangle' | 'circle' | 'text' | 'icon' | 'image';
  color: RGB;
  path?: string; // SVG path for complex shapes
}

class ImageProcessor {
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;

  constructor(private width: number, private height: number) {
    this.canvas = new OffscreenCanvas(width, height);
    this.ctx = this.canvas.getContext('2d')!;
  }

  async processImage(imageData: Uint8Array): Promise<ProcessedSegment[]> {
    // Create image bitmap from data
    const blob = new Blob([imageData], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    
    // Draw to canvas
    this.ctx.drawImage(bitmap, 0, 0);
    
    // Get pixel data
    const pixelData = this.ctx.getImageData(0, 0, this.width, this.height);
    
    // Perform edge detection
    const edges = this.detectEdges(pixelData);
    
    // Find contours
    const contours = this.findContours(edges);
    
    // Process each contour into a segment
    const segments: ProcessedSegment[] = [];
    
    for (const contour of contours) {
      const segment = this.processContour(contour, pixelData);
      if (segment) {
        segments.push(segment);
      }
    }
    
    return segments;
  }

  private detectEdges(imageData: ImageData): ImageData {
    // Sobel edge detection
    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const output = new ImageData(width, height);
    const dst = output.data;
    
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let pixelX = 0;
        let pixelY = 0;
        
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const idx = ((y + j) * width + (x + i)) * 4;
            const gray = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
            const kernelIdx = (j + 1) * 3 + (i + 1);
            
            pixelX += gray * sobelX[kernelIdx];
            pixelY += gray * sobelY[kernelIdx];
          }
        }
        
        const magnitude = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
        const index = (y * width + x) * 4;
        
        dst[index] = dst[index + 1] = dst[index + 2] = magnitude > 30 ? 255 : 0;
        dst[index + 3] = 255;
      }
    }
    
    return output;
  }

  private findContours(edges: ImageData): Array<Array<{x: number, y: number}>> {
    // Simplified contour detection
    const contours: Array<Array<{x: number, y: number}>> = [];
    const visited = new Set<string>();
    const width = edges.width;
    const height = edges.height;
    const data = edges.data;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        
        const index = (y * width + x) * 4;
        if (data[index] > 128) {
          const contour = this.traceContour(x, y, edges, visited);
          if (contour.length > 10) {
            contours.push(contour);
          }
        }
      }
    }
    
    return contours;
  }

  private traceContour(
    startX: number, 
    startY: number, 
    edges: ImageData, 
    visited: Set<string>
  ): Array<{x: number, y: number}> {
    const contour: Array<{x: number, y: number}> = [];
    const queue = [[startX, startY]];
    const width = edges.width;
    const data = edges.data;
    
    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      const key = `${x},${y}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      const index = (y * width + x) * 4;
      if (data[index] > 128) {
        contour.push({ x, y });
        
        // Check neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < edges.height) {
              queue.push([nx, ny]);
            }
          }
        }
      }
    }
    
    return contour;
  }

  private processContour(
    contour: Array<{x: number, y: number}>, 
    originalImage: ImageData
  ): ProcessedSegment | null {
    if (contour.length < 10) return null;
    
    // Find bounding box
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const point of contour) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    
    const bounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
    
    // Skip very small segments
    if (bounds.width < 10 || bounds.height < 10) return null;
    
    // Determine shape type
    const aspectRatio = bounds.width / bounds.height;
    let type: ProcessedSegment['type'] = 'rectangle';
    
    if (Math.abs(aspectRatio - 1) < 0.2) {
      // Nearly square, could be icon or circle
      type = this.isCircular(contour) ? 'circle' : 'icon';
    } else if (aspectRatio > 3 && bounds.height < 50) {
      type = 'text';
    } else if (this.hasComplexTexture(bounds, originalImage)) {
      type = 'image';
    }
    
    // Extract dominant color
    const color = this.extractRegionColor(bounds, originalImage);
    
    return {
      bounds,
      type,
      color
    };
  }

  private isCircular(contour: Array<{x: number, y: number}>): boolean {
    // Simple circularity test
    const center = contour.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), 
      { x: 0, y: 0 }
    );
    center.x /= contour.length;
    center.y /= contour.length;
    
    const avgRadius = contour.reduce((sum, p) => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0) / contour.length;
    
    const variance = contour.reduce((sum, p) => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      return sum + Math.pow(radius - avgRadius, 2);
    }, 0) / contour.length;
    
    return variance < avgRadius * 0.2;
  }

  private hasComplexTexture(
    bounds: { x: number; y: number; width: number; height: number }, 
    imageData: ImageData
  ): boolean {
    // Sample pixels and check for high variance (indicates complex image)
    const samples = 20;
    const colors: Array<{r: number, g: number, b: number}> = [];
    
    for (let i = 0; i < samples; i++) {
      const x = bounds.x + Math.floor(Math.random() * bounds.width);
      const y = bounds.y + Math.floor(Math.random() * bounds.height);
      const idx = (y * imageData.width + x) * 4;
      
      colors.push({
        r: imageData.data[idx],
        g: imageData.data[idx + 1],
        b: imageData.data[idx + 2]
      });
    }
    
    // Calculate color variance
    const avgColor = colors.reduce(
      (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }), 
      { r: 0, g: 0, b: 0 }
    );
    avgColor.r /= samples;
    avgColor.g /= samples;
    avgColor.b /= samples;
    
    const variance = colors.reduce((sum, c) => {
      return sum + 
        Math.pow(c.r - avgColor.r, 2) + 
        Math.pow(c.g - avgColor.g, 2) + 
        Math.pow(c.b - avgColor.b, 2);
    }, 0) / samples;
    
    return variance > 1000;
  }

  private extractRegionColor(
    bounds: { x: number; y: number; width: number; height: number }, 
    imageData: ImageData
  ): RGB {
    let r = 0, g = 0, b = 0;
    let count = 0;
    
    // Sample center region
    const sampleSize = Math.min(10, bounds.width / 2, bounds.height / 2);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    
    for (let dy = -sampleSize; dy <= sampleSize; dy++) {
      for (let dx = -sampleSize; dx <= sampleSize; dx++) {
        const x = Math.floor(centerX + dx);
        const y = Math.floor(centerY + dy);
        
        if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
          const idx = (y * imageData.width + x) * 4;
          r += imageData.data[idx];
          g += imageData.data[idx + 1];
          b += imageData.data[idx + 2];
          count++;
        }
      }
    }
    
    return {
      r: r / count / 255,
      g: g / count / 255,
      b: b / count / 255
    };
  }
}

// Export for use in main code.ts
export { ImageProcessor, ProcessedSegment };