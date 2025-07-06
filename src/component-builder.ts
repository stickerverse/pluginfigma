/**
 * Component Builder - Advanced Figma component creation system
 * Creates true system-ready components with Auto Layout, styles and variants
 */

import { ComponentData, ColorData, TypographyData } from './types';

// Component creation system with smart Auto Layout detection
export class ComponentBuilder {
  private componentCache: Map<string, ComponentSetNode | ComponentNode> = new Map();
  private styleCache: {
    colors: Map<string, PaintStyle>,
    text: Map<string, TextStyle>
  } = {
    colors: new Map(),
    text: new Map()
  };
  
  /**
   * Create a system-ready component from component data
   */
  async createSystemComponent(data: ComponentData): Promise<ComponentNode> {
    // Check if we're dealing with simplified data
    const isSimplified = this.isSimplifiedComponentData(data);
    
    if (isSimplified) {
      console.log('Working with simplified component data for:', data.name);
      figma.notify('Creating basic component from simplified data', { timeout: 3000 });
    }
    
    // Create the base component
    const component = figma.createComponent();
    component.name = data.name || 'Component';
    
    // Ensure width and height have valid values
    const width = typeof data.width === 'number' && data.width > 0 ? data.width : 100;
    const height = typeof data.height === 'number' && data.height > 0 ? data.height : 100;
    component.resize(width, height);
    
    // Apply Auto Layout if we can detect it from the data (skip if simplified)
    if (!isSimplified) {
      this.applyAutoLayout(component, data);
    }
    
    // Apply fills with style linking
    if (data.fills && data.fills.length > 0) {
      await this.applyPaintStyles(component, data.fills, 'fills');
    } else if (isSimplified) {
      // Apply a default fill for simplified components
      component.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
    }
    
    // Apply strokes with style linking
    if (data.strokes && data.strokes.length > 0) {
      await this.applyPaintStyles(component, data.strokes, 'strokes');
    }
    
    // Create and add children
    if (data.children && data.children.length > 0) {
      await this.createChildElements(component, data);
    } else if (isSimplified) {
      // Add a placeholder text element for simplified components
      const text = figma.createText();
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      text.fontName = { family: "Inter", style: "Regular" };
      text.characters = `Simplified component: ${data.name || 'Untitled'}`;
      text.fontSize = 12;
      text.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
      component.appendChild(text);
    }
    
    // Apply corner radius if specified
    if (data.properties && data.properties.cornerRadius) {
      component.cornerRadius = data.properties.cornerRadius;
    }
    
    return component;
  }
  
  /**
   * Creates a component set with variants from multiple component states
   */
  async createComponentSet(components: ComponentData[], propertyNames: string[] = ['State']): Promise<ComponentSetNode | ComponentNode> {
    // Create all component variants first
    const componentNodes: ComponentNode[] = [];
    
    for (let i = 0; i < components.length; i++) {
      const state = components[i];
      const componentNode = await this.createSystemComponent(state);
      
      // Set variant property based on index or provided name
      const propertyName = propertyNames[0] || 'State';
      const propertyValue = state.properties?.state || (i === 0 ? 'Default' : `State${i+1}`);
      
      // Set component property
      componentNode.setRelaunchData({ [propertyName]: propertyValue });
      
      componentNodes.push(componentNode);
    }
    
    // Create the component set from variants
    if (componentNodes.length > 1) {
      const componentSet = figma.combineAsVariants(componentNodes, figma.currentPage);
      componentSet.name = components[0].name || 'Component Set';
      return componentSet;
    } else if (componentNodes.length === 1) {
      // Just return the single component if there's only one
      return componentNodes[0];
    }
    
    throw new Error('No components created for component set');
  }
  
  /**
   * Detects if the component data is in simplified format
   * Simplified data has limited properties and might lack detailed style information
   */
  private isSimplifiedComponentData(data: ComponentData): boolean {
    // Check for telltale signs of simplified data:
    // 1. Simplified flag explicitly set
    if (data.hasOwnProperty('simplified')) return true;
    
    // 2. Missing children array when we'd expect them
    if (!data.children || data.children.length === 0) {
      // Real components usually have children, unless they're very simple shapes
      if (data.type && ['FRAME', 'GROUP', 'SECTION', 'COMPONENT'].includes(data.type)) {
        return true;
      }
    }
    
    // 3. Missing fills and properties that would usually be present
    if (!data.fills && !data.strokes && !data.properties) {
      return true;
    }
    
    return false;
  }

  /**
   * Intelligently applies Auto Layout to a component based on its data
   */
  private applyAutoLayout(node: FrameNode | ComponentNode, data: ComponentData): void {
    // Set Auto Layout properties
    if (data.properties?.layout) {
      // Use explicit layout properties if available
      const layout = data.properties.layout;
      
      // Apply Auto Layout
      node.layoutMode = layout.direction === 'HORIZONTAL' ? 'HORIZONTAL' : 'VERTICAL';
      node.primaryAxisSizingMode = 'AUTO';
      node.counterAxisSizingMode = 'AUTO';
      
      // Apply spacing
      if (layout.spacing !== undefined) {
        node.itemSpacing = layout.spacing;
      }
      
      // Apply padding
      if (layout.padding) {
        node.paddingTop = layout.padding.top || 0;
        node.paddingRight = layout.padding.right || 0;
        node.paddingBottom = layout.padding.bottom || 0;
        node.paddingLeft = layout.padding.left || 0;
      }
    } else {
      // Auto-detect layout from children (if any)
      this.detectAndApplyAutoLayout(node, data);
    }
  }
  
  /**
   * Detects the optimal Auto Layout settings by analyzing child positions
   */
  private detectAndApplyAutoLayout(node: FrameNode | ComponentNode, data: ComponentData): void {
    // Skip if no children to analyze
    if (!data.children || data.children.length <= 1) {
      return;
    }
    
    // Analyze child elements for layout direction
    let isHorizontal = true;
    let isVertical = true;
    let spacing = 0;
    let spacingCounts = 0;
    
    // Get children data by ID lookup (assuming children array has IDs that match components)
    const childrenData: ComponentData[] = [];
    
    // Sort children by Y position to analyze vertical spacing
    const sortedVertical = [...childrenData].sort((a, b) => a.y - b.y);
    
    // Check if items are arranged vertically with consistent spacing
    for (let i = 1; i < sortedVertical.length; i++) {
      const current = sortedVertical[i];
      const previous = sortedVertical[i-1];
      const verticalGap = current.y - (previous.y + previous.height);
      
      // If any vertical gap is negative or very different, not a vertical layout
      if (verticalGap < 0) {
        isVertical = false;
      }
      
      spacing += verticalGap;
      spacingCounts++;
    }
    
    // Sort children by X position to analyze horizontal spacing
    const sortedHorizontal = [...childrenData].sort((a, b) => a.x - b.x);
    
    // Check if items are arranged horizontally with consistent spacing
    for (let i = 1; i < sortedHorizontal.length; i++) {
      const current = sortedHorizontal[i];
      const previous = sortedHorizontal[i-1];
      const horizontalGap = current.x - (previous.x + previous.width);
      
      // If any horizontal gap is negative or very different, not a horizontal layout
      if (horizontalGap < 0) {
        isHorizontal = false;
      }
    }
    
    // Determine layout direction
    if (isVertical && !isHorizontal) {
      // Vertical layout
      node.layoutMode = 'VERTICAL';
    } else if (isHorizontal && !isVertical) {
      // Horizontal layout
      node.layoutMode = 'HORIZONTAL';
    } else if (!isHorizontal && !isVertical) {
      // Free layout - don't apply Auto Layout
      return;
    } else {
      // Default to vertical if both seem plausible
      node.layoutMode = 'VERTICAL';
    }
    
    // Set Auto Layout properties
    node.primaryAxisSizingMode = 'AUTO';
    node.counterAxisSizingMode = 'AUTO';
    
    // Apply average spacing if we calculated any
    if (spacingCounts > 0) {
      node.itemSpacing = spacing / spacingCounts;
    }
    
    // Auto-detect padding based on children position
    this.detectAndApplyPadding(node, childrenData);
  }
  
  /**
   * Detects appropriate padding by analyzing child positions
   */
  private detectAndApplyPadding(node: FrameNode | ComponentNode, children: ComponentData[]): void {
    if (children.length === 0) return;
    
    // Find minimum distance from edges to determine padding
    let paddingTop = Number.MAX_VALUE;
    let paddingLeft = Number.MAX_VALUE;
    let paddingRight = Number.MAX_VALUE;
    let paddingBottom = Number.MAX_VALUE;
    
    children.forEach(child => {
      // Top padding is distance from child's top to frame top
      paddingTop = Math.min(paddingTop, child.y);
      
      // Left padding is distance from child's left to frame left
      paddingLeft = Math.min(paddingLeft, child.x);
      
      // Right padding is distance from child's right to frame right
      const rightDistance = node.width - (child.x + child.width);
      paddingRight = Math.min(paddingRight, rightDistance);
      
      // Bottom padding is distance from child's bottom to frame bottom
      const bottomDistance = node.height - (child.y + child.height);
      paddingBottom = Math.min(paddingBottom, bottomDistance);
    });
    
    // Apply detected padding if reasonable values
    node.paddingTop = paddingTop > 0 && paddingTop < 100 ? paddingTop : 0;
    node.paddingLeft = paddingLeft > 0 && paddingLeft < 100 ? paddingLeft : 0;
    node.paddingRight = paddingRight > 0 && paddingRight < 100 ? paddingRight : 0;
    node.paddingBottom = paddingBottom > 0 && paddingBottom < 100 ? paddingBottom : 0;
  }
  
  /**
   * Applies paint styles to a node, creating or reusing styles
   */
  private async applyPaintStyles(
    node: SceneNode, 
    paints: any[], 
    propertyName: 'fills' | 'strokes'
  ): Promise<void> {
    // Ensure node supports this property
    if (!(propertyName in node)) {
      return;
    }
    
    // Apply the actual paints first
    (node as any)[propertyName] = paints;
    
    // For solid colors, we can create and apply styles
    if (paints.length === 1 && paints[0].type === 'SOLID') {
      const paint = paints[0];
      const { r, g, b } = paint.color;
      const opacity = paint.opacity || 1;
      
      // Generate a color name based on RGB values
      const colorName = this.generateColorName({ r, g, b }, opacity);
      const styleName = `Color/${colorName}`;
      
      // Check if style already exists in our cache or in Figma
      let style = this.styleCache.colors.get(styleName);
      if (!style) {
        // No direct API to get style by name, so we'll skip this for now
        style = null;
      }
      
      // Create the style if it doesn't exist
      if (!style) {
        style = figma.createPaintStyle();
        style.name = styleName;
        style.paints = [paint];
        this.styleCache.colors.set(styleName, style);
      }
      
      // Apply the style to the node
      if (propertyName === 'fills' && 'fillStyleId' in node) {
        node.fillStyleId = style.id;
      } else if (propertyName === 'strokes' && 'strokeStyleId' in node) {
        node.strokeStyleId = style.id;
      }
    }
  }
  
  /**
   * Creates child elements for a component
   */
  private async createChildElements(
    parent: FrameNode | ComponentNode, 
    parentData: ComponentData
  ): Promise<void> {
    if (!parentData.children || parentData.children.length === 0) {
      return;
    }
    
    // TODO: Implement child element creation based on child IDs or references
  }
  
  /**
   * Creates or reuses a text style
   */
  private async createOrReuseTextStyle(
    textData: TypographyData
  ): Promise<TextStyle | null> {
    if (!textData.fontName || !textData.fontSize) {
      return null;
    }
    
    // Generate style name based on font properties
    const styleName = `Text/${textData.fontName.family}-${textData.fontName.style}/${textData.fontSize}`;
    
    // Check if style already exists in our cache or in Figma
    let style = this.styleCache.text.get(styleName);
    if (!style) {
      // No direct API to get style by name, so we'll skip this for now
      style = null;
    }
    
    // Create the style if it doesn't exist
    if (!style) {
      style = figma.createTextStyle();
      style.name = styleName;
      await figma.loadFontAsync(textData.fontName);
      style.fontName = textData.fontName;
      style.fontSize = textData.fontSize;
      this.styleCache.text.set(styleName, style);
    }
    
    return style;
  }
  
  /**
   * Generates a semantic color name based on RGB values
   */
  private generateColorName(
    color: { r: number; g: number; b: number }, 
    opacity: number = 1
  ): string {
    // Convert RGB (0-1) to HSL for better naming
    const r = color.r * 255;
    const g = color.g * 255;
    const b = color.b * 255;
    
    // Calculate HSL
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 510; // Lightness 0-1
    
    // If it's a shade of gray (R=G=B approximately)
    if (Math.abs(r - g) < 10 && Math.abs(g - b) < 10) {
      // Name based on lightness
      if (l > 0.9) return "White";
      if (l > 0.7) return "LightGray";
      if (l > 0.4) return "Gray";
      if (l > 0.1) return "DarkGray";
      return "Black";
    }
    
    // Determine basic color name based on RGB proportions
    if (r > g && r > b) return "Red";
    if (g > r && g > b) return "Green";
    if (b > r && b > g) return "Blue";
    if (r > b && g > b && (r - g) < 30) return "Yellow";
    if (r > g && b > g) return "Purple";
    if (g > r && b > r) return "Cyan";
    
    // Default case
    return `Color-${Math.round(r)}-${Math.round(g)}-${Math.round(b)}`;
  }
}

export default new ComponentBuilder();
