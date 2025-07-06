/**
 * Enhanced Content Script for Chrome Extension
 * Provides advanced element selection UI with multi-selection and preview
 */

import { elementCapture, CaptureOptions, CaptureResult } from './capture';

export interface SelectionOptions {
  multiSelect?: boolean;
  showPreview?: boolean;
  confirmCapture?: boolean;
  highlightColor?: string;
  borderWidth?: number;
}

export interface SelectedElement {
  element: HTMLElement;
  id: string;
  selector: string;
  bounds: DOMRect;
  preview?: string;
}

/**
 * Enhanced element selection manager
 */
export class ElementSelector {
  private static instance: ElementSelector;
  private isActive = false;
  private selectedElements: SelectedElement[] = [];
  private currentHoverElement: HTMLElement | null = null;
  private selectionOverlay: HTMLElement | null = null;
  private previewContainer: HTMLElement | null = null;
  private confirmationDialog: HTMLElement | null = null;
  private options: SelectionOptions = {};
  
  // Event handlers (bound to preserve context)
  private handleMouseMove = this.onMouseMove.bind(this);
  private handleClick = this.onClick.bind(this);
  private handleKeyDown = this.onKeyDown.bind(this);
  
  private constructor() {
    this.createOverlayElements();
  }
  
  public static getInstance(): ElementSelector {
    if (!ElementSelector.instance) {
      ElementSelector.instance = new ElementSelector();
    }
    return ElementSelector.instance;
  }

  /**
   * Start element selection mode
   */
  public startSelection(options: SelectionOptions = {}): void {
    if (this.isActive) return;
    
    this.options = {
      multiSelect: false,
      showPreview: true,
      confirmCapture: true,
      highlightColor: '#007ACC',
      borderWidth: 2,
      ...options
    };
    
    this.isActive = true;
    this.selectedElements = [];
    
    // Add event listeners
    document.addEventListener('mousemove', this.handleMouseMove, true);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    
    // Show UI elements
    this.showSelectionOverlay();
    if (this.options.showPreview) {
      this.showPreviewContainer();
    }
    
    // Update cursor
    document.body.style.cursor = 'crosshair';
    
    console.log('Element selection started with options:', this.options);
  }

  /**
   * Stop element selection mode
   */
  public stopSelection(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.currentHoverElement = null;
    
    // Remove event listeners
    document.removeEventListener('mousemove', this.handleMouseMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    
    // Hide UI elements
    this.hideSelectionOverlay();
    this.hidePreviewContainer();
    this.hideConfirmationDialog();
    
    // Restore cursor
    document.body.style.cursor = '';
    
    console.log('Element selection stopped');
  }

  /**
   * Get currently selected elements
   */
  public getSelectedElements(): SelectedElement[] {
    return [...this.selectedElements];
  }

  /**
   * Clear all selected elements
   */
  public clearSelection(): void {
    this.selectedElements = [];
    this.updatePreviewContainer();
  }

  /**
   * Capture selected elements
   */
  public async captureSelectedElements(captureOptions: CaptureOptions = {}): Promise<CaptureResult[]> {
    if (this.selectedElements.length === 0) {
      throw new Error('No elements selected for capture');
    }
    
    const elements = this.selectedElements.map(sel => sel.element);
    const results = await elementCapture.captureMultipleElements(elements, captureOptions);
    
    return results;
  }

  /**
   * Handle mouse movement for element highlighting
   */
  private onMouseMove(event: MouseEvent): void {
    if (!this.isActive) return;
    
    // Ignore our own UI elements
    if (this.isOwnUIElement(event.target as HTMLElement)) {
      return;
    }
    
    const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement;
    if (!element || element === this.currentHoverElement) return;
    
    this.currentHoverElement = element;
    this.updateSelectionOverlay(element);
  }

  /**
   * Handle click for element selection
   */
  private onClick(event: MouseEvent): void {
    if (!this.isActive) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    // Ignore clicks on our UI elements
    if (this.isOwnUIElement(event.target as HTMLElement)) {
      return;
    }
    
    const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement;
    if (!element) return;
    
    this.selectElement(element);
  }

  /**
   * Handle keyboard events
   */
  private onKeyDown(event: KeyboardEvent): void {
    if (!this.isActive) return;
    
    switch (event.key) {
      case 'Escape':
        this.stopSelection();
        break;
        
      case 'Enter':
        if (this.selectedElements.length > 0) {
          this.showCaptureConfirmation();
        }
        break;
        
      case 'Delete':
      case 'Backspace':
        if (this.selectedElements.length > 0) {
          this.selectedElements.pop(); // Remove last selected
          this.updatePreviewContainer();
        }
        break;
        
      case 'c':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.clearSelection();
        }
        break;
    }
  }

  /**
   * Select an element
   */
  private async selectElement(element: HTMLElement): Promise<void> {
    // Check if element is already selected
    const existingIndex = this.selectedElements.findIndex(sel => sel.element === element);
    
    if (existingIndex >= 0) {
      // Remove if already selected (toggle behavior)
      this.selectedElements.splice(existingIndex, 1);
    } else {
      // Add new selection
      const selectedElement: SelectedElement = {
        element,
        id: this.generateElementId(element),
        selector: this.generateSelector(element),
        bounds: element.getBoundingClientRect()
      };
      
      // Generate preview if requested
      if (this.options.showPreview) {
        try {
          const result = await elementCapture.captureElement({ 
            element, 
            quality: 0.5 // Lower quality for preview
          });
          selectedElement.preview = result.dataUrl;
        } catch (error) {
          console.warn('Failed to generate preview for element:', error);
        }
      }
      
      this.selectedElements.push(selectedElement);
      
      // If not multi-select mode, clear previous selections
      if (!this.options.multiSelect && this.selectedElements.length > 1) {
        this.selectedElements = [selectedElement];
      }
    }
    
    this.updatePreviewContainer();
    
    // Show capture confirmation if not in multi-select mode
    if (!this.options.multiSelect && this.options.confirmCapture) {
      this.showCaptureConfirmation();
    }
  }

  /**
   * Create overlay elements
   */
  private createOverlayElements(): void {
    // Selection overlay
    this.selectionOverlay = document.createElement('div');
    this.selectionOverlay.id = 'sticker-selection-overlay';
    this.selectionOverlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 999999;
      display: none;
      box-sizing: border-box;
      transition: all 0.1s ease;
    `;
    
    // Preview container
    this.previewContainer = document.createElement('div');
    this.previewContainer.id = 'sticker-preview-container';
    this.previewContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      max-height: 400px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 1000000;
      display: none;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    `;
    
    // Confirmation dialog
    this.confirmationDialog = document.createElement('div');
    this.confirmationDialog.id = 'sticker-confirmation-dialog';
    this.confirmationDialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 1000001;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      min-width: 320px;
    `;
  }

  /**
   * Show selection overlay
   */
  private showSelectionOverlay(): void {
    if (!this.selectionOverlay) return;
    
    if (!this.selectionOverlay.parentElement) {
      document.body.appendChild(this.selectionOverlay);
    }
  }

  /**
   * Hide selection overlay
   */
  private hideSelectionOverlay(): void {
    if (this.selectionOverlay) {
      this.selectionOverlay.style.display = 'none';
    }
  }

  /**
   * Update selection overlay position and style
   */
  private updateSelectionOverlay(element: HTMLElement): void {
    if (!this.selectionOverlay) return;
    
    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    const isSelected = this.selectedElements.some(sel => sel.element === element);
    const color = isSelected ? '#22C55E' : (this.options.highlightColor || '#007ACC');
    const borderWidth = this.options.borderWidth || 2;
    
    this.selectionOverlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 999999;
      display: block;
      box-sizing: border-box;
      transition: all 0.1s ease;
      left: ${rect.left + scrollX}px;
      top: ${rect.top + scrollY}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: ${borderWidth}px solid ${color};
      background: ${color}20;
      backdrop-filter: blur(1px);
    `;
    
    // Add element info label
    this.addElementInfoLabel(element, rect);
  }

  /**
   * Add element information label
   */
  private addElementInfoLabel(element: HTMLElement, rect: DOMRect): void {
    const label = document.createElement('div');
    label.style.cssText = `
      position: absolute;
      top: -28px;
      left: 0;
      background: #333;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      white-space: nowrap;
      pointer-events: none;
    `;
    
    const tagName = element.tagName.toLowerCase();
    const className = element.className ? `.${element.className.split(' ')[0]}` : '';
    const id = element.id ? `#${element.id}` : '';
    
    label.textContent = `${tagName}${id}${className} (${Math.round(rect.width)}×${Math.round(rect.height)})`;
    
    // Clear previous label and add new one
    const existingLabel = this.selectionOverlay?.querySelector('.element-info-label');
    if (existingLabel) {
      existingLabel.remove();
    }
    
    label.className = 'element-info-label';
    this.selectionOverlay?.appendChild(label);
  }

  /**
   * Show preview container
   */
  private showPreviewContainer(): void {
    if (!this.previewContainer) return;
    
    if (!this.previewContainer.parentElement) {
      document.body.appendChild(this.previewContainer);
    }
    
    this.updatePreviewContainer();
  }

  /**
   * Hide preview container
   */
  private hidePreviewContainer(): void {
    if (this.previewContainer) {
      this.previewContainer.style.display = 'none';
    }
  }

  /**
   * Update preview container content
   */
  private updatePreviewContainer(): void {
    if (!this.previewContainer) return;
    
    if (this.selectedElements.length === 0) {
      this.previewContainer.style.display = 'none';
      return;
    }
    
    this.previewContainer.style.display = 'block';
    
    const header = `
      <div style="padding: 16px; border-bottom: 1px solid #eee;">
        <h3 style="margin: 0; font-size: 14px; font-weight: 600;">
          Selected Elements (${this.selectedElements.length})
        </h3>
        <p style="margin: 4px 0 0; font-size: 12px; color: #666;">
          ${this.options.multiSelect ? 'Click to toggle, ' : ''}Enter to capture, Escape to cancel
        </p>
      </div>
    `;
    
    const items = this.selectedElements.map((sel, index) => `
      <div style="padding: 12px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 12px;">
        ${sel.preview ? `<img src="${sel.preview}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">` : ''}
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 12px; font-weight: 500; color: #333; margin-bottom: 2px;">
            ${sel.element.tagName.toLowerCase()}${sel.element.id ? `#${sel.element.id}` : ''}
          </div>
          <div style="font-size: 11px; color: #666; word-break: break-all;">
            ${Math.round(sel.bounds.width)}×${Math.round(sel.bounds.height)}
          </div>
        </div>
        <button onclick="window.stickerElementSelector?.removeSelectedElement(${index})" 
                style="border: none; background: #f5f5f5; border-radius: 4px; padding: 4px; cursor: pointer;">
          ×
        </button>
      </div>
    `).join('');
    
    const footer = `
      <div style="padding: 16px; display: flex; gap: 8px;">
        <button onclick="window.stickerElementSelector?.captureAndFinish()" 
                style="flex: 1; background: #007ACC; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-size: 12px;">
          Capture ${this.selectedElements.length} Element${this.selectedElements.length > 1 ? 's' : ''}
        </button>
        <button onclick="window.stickerElementSelector?.clearSelection()" 
                style="background: #f5f5f5; color: #333; border: none; border-radius: 6px; padding: 8px 12px; cursor: pointer; font-size: 12px;">
          Clear
        </button>
      </div>
    `;
    
    this.previewContainer.innerHTML = header + items + footer;
  }

  /**
   * Show capture confirmation dialog
   */
  private showCaptureConfirmation(): void {
    if (!this.confirmationDialog || this.selectedElements.length === 0) return;
    
    if (!this.confirmationDialog.parentElement) {
      document.body.appendChild(this.confirmationDialog);
    }
    
    const count = this.selectedElements.length;
    const elementText = count === 1 ? 'element' : 'elements';
    
    this.confirmationDialog.innerHTML = `
      <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600;">
        Capture ${count} ${elementText}?
      </h3>
      <p style="margin: 0 0 20px; font-size: 14px; color: #666; line-height: 1.5;">
        This will capture the selected ${elementText} and send ${count === 1 ? 'it' : 'them'} to Figma for processing.
      </p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button onclick="window.stickerElementSelector?.cancelCapture()" 
                style="background: #f5f5f5; color: #333; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer;">
          Cancel
        </button>
        <button onclick="window.stickerElementSelector?.confirmCapture()" 
                style="background: #007ACC; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer;">
          Capture Now
        </button>
      </div>
    `;
    
    this.confirmationDialog.style.display = 'block';
  }

  /**
   * Hide confirmation dialog
   */
  private hideConfirmationDialog(): void {
    if (this.confirmationDialog) {
      this.confirmationDialog.style.display = 'none';
    }
  }

  /**
   * Check if element is our own UI element
   */
  private isOwnUIElement(element: HTMLElement): boolean {
    if (!element) return false;
    
    const ownIds = [
      'sticker-selection-overlay',
      'sticker-preview-container', 
      'sticker-confirmation-dialog'
    ];
    
    return ownIds.some(id => 
      element.id === id || element.closest(`#${id}`)
    );
  }

  /**
   * Generate unique element ID
   */
  private generateElementId(element: HTMLElement): string {
    return `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate CSS selector for element
   */
  private generateSelector(element: HTMLElement): string {
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
          selector += '.' + classes[0]; // Use first class only
        }
      }
      
      path.unshift(selector);
      current = current.parentElement;
    }
    
    return path.join(' > ');
  }

  // Public methods for global access
  public removeSelectedElement(index: number): void {
    if (index >= 0 && index < this.selectedElements.length) {
      this.selectedElements.splice(index, 1);
      this.updatePreviewContainer();
    }
  }

  public async captureAndFinish(): Promise<void> {
    try {
      const results = await this.captureSelectedElements();
      
      // Send to extension
      results.forEach(result => {
        document.dispatchEvent(new CustomEvent('STICKER_SEND_TO_EXTENSION', {
          detail: {
            type: 'COMPONENT_CAPTURED',
            component: {
              imageData: result.dataUrl,
              width: result.width,
              height: result.height,
              metadata: result.metadata
            }
          }
        }));
      });
      
      this.stopSelection();
    } catch (error) {
      console.error('Failed to capture elements:', error);
      alert('Failed to capture elements. Please try again.');
    }
  }

  public confirmCapture(): void {
    this.hideConfirmationDialog();
    this.captureAndFinish();
  }

  public cancelCapture(): void {
    this.hideConfirmationDialog();
  }
}

// Export singleton instance
export const elementSelector = ElementSelector.getInstance();

// Make available globally for button callbacks
(window as any).stickerElementSelector = elementSelector;