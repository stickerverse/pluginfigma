/**
 * Enhanced Capture Module for Chrome Extension
 * Provides high-quality screenshot capture with advanced features
 */

export interface CaptureOptions {
  element?: HTMLElement;
  highDPI?: boolean;
  includeCrossOrigin?: boolean;
  scrollLargeElements?: boolean;
  includeShadowDOM?: boolean;
  quality?: number; // 0.1 to 1.0
}

export interface CaptureResult {
  dataUrl: string;
  width: number;
  height: number;
  pixelRatio: number;
  originalElement: HTMLElement;
  metadata: CaptureMetadata;
}

export interface CaptureMetadata {
  timestamp: number;
  url: string;
  elementSelector: string;
  crossOriginElements: boolean;
  shadowDOMIncluded: boolean;
  scrollingApplied: boolean;
  pixelRatio: number;
}

/**
 * Enhanced screenshot capture class with advanced features
 */
export class ElementCapture {
  private static instance: ElementCapture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  private constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }
  
  public static getInstance(): ElementCapture {
    if (!ElementCapture.instance) {
      ElementCapture.instance = new ElementCapture();
    }
    return ElementCapture.instance;
  }

  /**
   * Enhanced element capture with high-DPI support
   */
  public async captureElement(options: CaptureOptions = {}): Promise<CaptureResult> {
    const {
      element = document.documentElement,
      highDPI = true,
      includeCrossOrigin = true,
      scrollLargeElements = true,
      includeShadowDOM = true,
      quality = 0.95
    } = options;

    // Get device pixel ratio for high-DPI support
    const pixelRatio = highDPI ? (window.devicePixelRatio || 1) : 1;
    
    // Get element bounds
    const elementRect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    // Handle large elements that extend beyond viewport
    let scrollingApplied = false;
    const originalScrollPosition = { x: scrollX, y: scrollY };
    
    if (scrollLargeElements && this.isElementLargerThanViewport(element)) {
      await this.scrollElementIntoFullView(element);
      scrollingApplied = true;
    }

    try {
      // Capture using html2canvas with enhanced options
      const captureOptions = {
        allowTaint: true,
        useCORS: includeCrossOrigin,
        scale: pixelRatio,
        width: elementRect.width,
        height: elementRect.height,
        x: elementRect.left + scrollX,
        y: elementRect.top + scrollY,
        backgroundColor: null,
        foreignObjectRendering: true,
        imageTimeout: 15000,
        removeContainer: true,
        logging: false,
        onclone: (clonedDoc: Document) => {
          // Handle shadow DOM elements if requested
          if (includeShadowDOM) {
            this.processShadowDOMElements(clonedDoc, element);
          }
          
          // Handle cross-origin elements
          if (includeCrossOrigin) {
            this.processCrossOriginElements(clonedDoc);
          }
        }
      };

      // Dynamic import of html2canvas for better performance
      const html2canvas = await this.loadHtml2Canvas();
      const canvas = await html2canvas(element, captureOptions);
      
      // Convert to data URL with specified quality
      const dataUrl = canvas.toDataURL('image/png', quality);
      
      // Generate metadata
      const metadata: CaptureMetadata = {
        timestamp: Date.now(),
        url: window.location.href,
        elementSelector: this.generateElementSelector(element),
        crossOriginElements: includeCrossOrigin,
        shadowDOMIncluded: includeShadowDOM,
        scrollingApplied,
        pixelRatio
      };

      return {
        dataUrl,
        width: canvas.width,
        height: canvas.height,
        pixelRatio,
        originalElement: element,
        metadata
      };
      
    } finally {
      // Restore original scroll position if we modified it
      if (scrollingApplied) {
        window.scrollTo(originalScrollPosition.x, originalScrollPosition.y);
      }
    }
  }

  /**
   * Capture multiple elements in sequence
   */
  public async captureMultipleElements(
    elements: HTMLElement[], 
    options: CaptureOptions = {}
  ): Promise<CaptureResult[]> {
    const results: CaptureResult[] = [];
    
    for (const element of elements) {
      try {
        const result = await this.captureElement({ ...options, element });
        results.push(result);
      } catch (error) {
        console.warn('Failed to capture element:', element, error);
      }
    }
    
    return results;
  }

  /**
   * Check if element is larger than current viewport
   */
  private isElementLargerThanViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    return rect.width > viewportWidth || rect.height > viewportHeight;
  }

  /**
   * Scroll element into full view for large elements
   */
  private async scrollElementIntoFullView(element: HTMLElement): Promise<void> {
    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    // Calculate the top-left position of the element
    const elementTop = rect.top + scrollY;
    const elementLeft = rect.left + scrollX;
    
    // Scroll to the element's top-left corner
    window.scrollTo(elementLeft, elementTop);
    
    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Process shadow DOM elements in the cloned document
   */
  private processShadowDOMElements(clonedDoc: Document, originalElement: HTMLElement): void {
    // Find all elements with shadow DOM in the original document
    const walker = document.createTreeWalker(
      originalElement,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node: Element) => {
          return (node as any).shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    );
    
    const shadowHosts: Element[] = [];
    let node;
    while (node = walker.nextNode()) {
      shadowHosts.push(node as Element);
    }
    
    // Process each shadow host
    shadowHosts.forEach(shadowHost => {
      const shadowRoot = (shadowHost as any).shadowRoot;
      if (shadowRoot) {
        try {
          // Find corresponding element in cloned document
          const selector = this.generateElementSelector(shadowHost as HTMLElement);
          const clonedHost = clonedDoc.querySelector(selector);
          
          if (clonedHost) {
            // Clone shadow root content
            const shadowContent = shadowRoot.innerHTML;
            const shadowContainer = clonedDoc.createElement('div');
            shadowContainer.innerHTML = shadowContent;
            shadowContainer.style.cssText = 'display: contents;';
            
            // Append shadow content to cloned host
            clonedHost.appendChild(shadowContainer);
          }
        } catch (error) {
          console.warn('Failed to process shadow DOM for element:', shadowHost, error);
        }
      }
    });
  }

  /**
   * Process cross-origin elements by replacing them with placeholders
   */
  private processCrossOriginElements(clonedDoc: Document): void {
    // Handle iframes
    const iframes = clonedDoc.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      if (this.isCrossOrigin(iframe.src)) {
        const placeholder = this.createCrossOriginPlaceholder(iframe, 'iframe');
        iframe.parentNode?.replaceChild(placeholder, iframe);
      }
    });
    
    // Handle images
    const images = clonedDoc.querySelectorAll('img');
    images.forEach(img => {
      if (this.isCrossOrigin(img.src)) {
        const placeholder = this.createCrossOriginPlaceholder(img, 'image');
        img.parentNode?.replaceChild(placeholder, img);
      }
    });
  }

  /**
   * Check if URL is cross-origin
   */
  private isCrossOrigin(url: string): boolean {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
      return false;
    }
    
    try {
      const urlObj = new URL(url, window.location.href);
      return urlObj.origin !== window.location.origin;
    } catch {
      return false;
    }
  }

  /**
   * Create placeholder for cross-origin elements
   */
  private createCrossOriginPlaceholder(element: HTMLElement, type: string): HTMLElement {
    const placeholder = document.createElement('div');
    const rect = element.getBoundingClientRect();
    
    placeholder.style.cssText = `
      width: ${rect.width}px;
      height: ${rect.height}px;
      background: #f0f0f0;
      border: 2px dashed #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      font-size: 12px;
      color: #666;
      text-align: center;
    `;
    
    placeholder.textContent = `Cross-origin ${type}`;
    return placeholder;
  }

  /**
   * Generate unique CSS selector for element
   */
  private generateElementSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }
    
    const path: string[] = [];
    let current: Element | null = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.className) {
        const classes = current.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }
      
      // Add nth-child if needed for uniqueness
      const siblings = Array.from(current.parentElement?.children || []);
      const sameTagSiblings = siblings.filter(s => s.tagName === current!.tagName);
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
      
      path.unshift(selector);
      current = current.parentElement;
    }
    
    return path.join(' > ');
  }

  /**
   * Dynamically load html2canvas library
   */
  private async loadHtml2Canvas(): Promise<any> {
    // Check if html2canvas is already loaded
    if ((window as any).html2canvas) {
      return (window as any).html2canvas;
    }
    
    // Load html2canvas dynamically
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      script.onload = () => {
        resolve((window as any).html2canvas);
      };
      script.onerror = () => {
        reject(new Error('Failed to load html2canvas library'));
      };
      document.head.appendChild(script);
    });
  }
}

// Export singleton instance
export const elementCapture = ElementCapture.getInstance();