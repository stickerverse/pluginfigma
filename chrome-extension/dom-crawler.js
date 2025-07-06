/**
 * DOM Crawler for Sticker Component Analyzer
 * 
 * This module analyzes web elements and extracts detailed style information
 * to create system-ready Figma components.
 */

// Define DOMCrawler as a window property to avoid duplication
window.DOMCrawler = {
  /**
   * Main entry point to analyze a DOM element with improved data sanitization
   * @param {HTMLElement} element - The element to analyze
   * @returns {Object} Detailed component data (sanitized for safe transmission)
   */
  analyzeElement(element) {
    if (!element) return null;
    
    try {
      // Generate unique ID for this element (limit length)
      const elementId = this._generateElementId(element).substring(0, 50);
      
      // Get computed styles - but only extract specific properties we need
      // Don't store the entire computedStyle object which is huge
      const computedStyle = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      
      // Basic component data - extract only necessary properties with explicit limits
      const componentData = {
        id: elementId,
        type: this._determineElementType(element),
        name: this._generateElementName(element), // Already has length limits
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        children: []
      };
      
      // Only include these properties if they have content (to reduce payload size)
      const fills = this._extractFills(computedStyle);
      if (fills && fills.length > 0) {
        // Limit to max 10 fills to prevent huge arrays
        componentData.fills = fills.slice(0, 10); 
      }
      
      const strokes = this._extractStrokes(computedStyle);
      if (strokes && strokes.length > 0) {
        // Limit to max 5 strokes
        componentData.strokes = strokes.slice(0, 5);
      }
      
      // Extract only essential properties, not the entire style object
      const essentialProperties = this._extractProperties(element, computedStyle);
      if (Object.keys(essentialProperties).length > 0) {
        componentData.properties = essentialProperties;
      }
      
      // Process typography if this is a text element (with sanitization)
      if (this._isTextElement(element)) {
        const typography = this._extractTypography(element, computedStyle, rect);
        // Limit text content length to prevent massive strings
        if (typography && typography.text) {
          typography.text = typography.text.substring(0, 500);
          componentData.typography = typography;
        }
      }
      
      // Process children recursively - use stricter limits
      this._processChildren(element, componentData, 1, 3); // Start with depth 1, max depth 3
      
      // Validate that the object can be serialized
      try {
        JSON.stringify(componentData);
      } catch (jsonError) {
        // If serialization fails, return a simplified version
        console.error('Failed to serialize component data:', jsonError);
        return this._createSimplifiedComponent(element, rect);
      }
      
      return componentData;
    } catch (error) {
      console.error('Error analyzing element:', error);
      // Return a simplified fallback object that won't cause serialization issues
      return this._createSimplifiedComponent(element);
    }
  },
  
  /**
   * Creates a minimal component representation that is guaranteed to be serializable
   * Used as a fallback when full analysis fails or produces too much data
   * @private
   */
  _createSimplifiedComponent(element, rect = null) {
    try {
      // If no element is provided, return a generic error component
      if (!element) {
        return {
          id: 'error-element',
          type: 'FRAME',
          name: 'Error Element',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          error: 'Invalid element'
        };
      }
      
      // Get position and size information if not provided
      if (!rect) {
        rect = element.getBoundingClientRect();
      }
      
      // Create a safe short name
      let safeName = 'Element';
      if (element.tagName) {
        safeName = element.tagName.toLowerCase();
      }
      if (element.id && element.id.length < 30) {
        safeName += ' #' + element.id;
      } else if (typeof element.className === 'string' && element.className.length < 30) {
        safeName += ' .' + element.className.split(' ')[0];
      }
      
      // Basic component data that can't fail serialization
      return {
        id: 'simplified-' + Math.random().toString(36).substring(2, 10),
        type: 'FRAME',
        name: safeName,
        x: Math.round(rect.left || 0),
        y: Math.round(rect.top || 0),
        width: Math.round(rect.width || 100),
        height: Math.round(rect.height || 100),
        simplified: true, // Flag to indicate this is simplified data
        children: []
      };
    } catch (error) {
      console.error('Error creating simplified component:', error);
      // Ultra-basic fallback that cannot fail
      return {
        id: 'error-fallback',
        type: 'FRAME',
        name: 'Error Element',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        error: 'Failed to create even a simplified component'
      };
    }
  },
  
  /**
   * Analyzes an element and all variants (hover, active, etc)
   * @param {HTMLElement} element - The element to analyze with variants
   * @returns {Object[]} Array of component data for each variant
   */
  async analyzeElementWithVariants(element) {
    if (!element) return [];
    
    // Start with the default state
    const defaultState = this.analyzeElement(element);
    defaultState.properties.state = 'Default';
    
    const variants = [defaultState];
    
    // Analyze hover state
    try {
      // Trigger hover state
      const hoverEvent = new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(hoverEvent);
      
      // Give browser time to apply hover styles
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capture hover state
      const hoverState = this.analyzeElement(element);
      hoverState.properties.state = 'Hover';
      
      // Only add if different from default
      if (this._statesAreDifferent(defaultState, hoverState)) {
        variants.push(hoverState);
      }
      
      // Reset state
      element.dispatchEvent(new MouseEvent('mouseout'));
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error capturing hover state:', error);
    }
    
    // Analyze active/pressed state
    try {
      // Trigger active state
      const mousedownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(mousedownEvent);
      
      // Give browser time to apply active styles
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capture active state
      const activeState = this.analyzeElement(element);
      activeState.properties.state = 'Pressed';
      
      // Only add if different
      if (this._statesAreDifferent(defaultState, activeState)) {
        variants.push(activeState);
      }
      
      // Reset state
      element.dispatchEvent(new MouseEvent('mouseup'));
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error capturing active state:', error);
    }
    
    return variants;
  },
  
  /**
   * Process children of an element recursively with better limits
   * @private
   */
  _processChildren(element, parentData, depth, maxDepth = 3) {
    // Don't go too deep to avoid performance issues and message size limitations
    if (depth > maxDepth) return;
    
    // Get all child elements
    const children = element.children;
    if (!children || children.length === 0) return;
    
    // Limit number of children to prevent huge objects
    const maxChildrenPerLevel = 10;
    const childrenToProcess = Array.from(children).slice(0, maxChildrenPerLevel);
    
    // Process each child - now with stricter limits
    const maxProcessedChildren = Math.min(childrenToProcess.length, 8); // Further limit to 8 children max
    for (let i = 0; i < maxProcessedChildren; i++) {
      const childElement = childrenToProcess[i];
      
      try {
        // Skip invisible elements
        if (!this._isElementVisible(childElement)) continue;
        
        // Skip iframes, script tags, and other problematic elements
        const tagName = childElement.tagName.toLowerCase();
        if (tagName === 'iframe' || tagName === 'script' || 
            tagName === 'style' || tagName === 'noscript' ||
            tagName === 'svg' || tagName === 'canvas') {
          continue;
        }
        
        // Get minimal computed style values rather than the full object
        const computedStyle = window.getComputedStyle(childElement);
        const rect = childElement.getBoundingClientRect();
        
        // Analyze this child - only capture essential properties with validation
        const childData = {
          id: this._generateElementId(childElement).substring(0, 50), // Limit ID length
          type: this._determineElementType(childElement),
          name: this._generateElementName(childElement), // Already has length limits
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
        
        // Only add minimal styles that are likely to be useful
        // Avoid full objects like computedStyle which are huge
        if (computedStyle.backgroundColor && computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          childData.backgroundColor = computedStyle.backgroundColor;
        }
        
        // Only create children array if we're below maximum depth and we'll process children
        if (depth < maxDepth - 1) {
          childData.children = [];
          // Process this child's children recursively, but only if this isn't a complex component already
          if (childElement.children.length < 15) { // Skip components that already have many children
            this._processChildren(childElement, childData, depth + 1, maxDepth);
          } else {
            // Just add a placeholder for many children
            childData.children.push({
              id: 'many-children-truncated',
              type: 'TEXT',
              name: `${childElement.children.length} children (truncated)`
            });
          }
        }
        
        // Add child to parent data
        parentData.children.push(childData);
      } catch (error) {
        console.error('Error processing child element:', error);
        // Add a placeholder for the error element
        parentData.children.push({
          id: 'error-child',
          type: 'FRAME',
          name: 'Error Child Element'
        });
      }
    }
    
    // If we limited the children, add a note
    if (children.length > maxChildrenPerLevel) {
      parentData.children.push({
        id: 'truncated-indicator',
        type: 'TEXT',
        name: `+${children.length - maxChildrenPerLevel} more children (truncated)`
      });
    }
  },
  
  /**
   * Determines the Figma node type based on HTML element
   * @private
   */
  _determineElementType(element) {
    const tagName = element.tagName.toLowerCase();
    
    switch (tagName) {
      case 'div':
      case 'section':
      case 'article':
      case 'nav':
      case 'header':
      case 'footer':
      case 'main':
        return 'FRAME';
      
      case 'button':
      case 'a':
        return 'COMPONENT';
      
      case 'img':
        return 'IMAGE';
      
      case 'p':
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
      case 'span':
      case 'label':
        return 'TEXT';
      
      case 'circle':
      case 'ellipse':
        return 'ELLIPSE';
      
      case 'path':
      case 'svg':
        return 'VECTOR';
      
      default:
        // Default to rectangle for most elements
        return 'RECTANGLE';
    }
  },
  
  /**
   * Extracts fill information from element style
   * @private
   */
  _extractFills(style) {
    const fills = [];
    
    // Background color
    if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
      const color = this._parseColor(style.backgroundColor);
      if (color) {
        fills.push({
          type: 'SOLID',
          color: {
            r: color.r / 255,
            g: color.g / 255,
            b: color.b / 255
          },
          opacity: color.a
        });
      }
    }
    
    // Background image
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      // Handle gradients
      if (style.backgroundImage.includes('linear-gradient')) {
        fills.push({
          type: 'GRADIENT_LINEAR',
          // This is simplified - a full implementation would parse the gradient
          gradientStops: [
            { position: 0, color: { r: 1, g: 1, b: 1, a: 1 } },
            { position: 1, color: { r: 0.9, g: 0.9, b: 0.9, a: 1 } }
          ]
        });
      }
      // Handle images
      else if (style.backgroundImage.includes('url')) {
        const imageUrl = this._extractUrlFromBackground(style.backgroundImage);
        if (imageUrl) {
          fills.push({
            type: 'IMAGE',
            imageHash: imageUrl, // Not actual hash, just storing URL reference
            scaleMode: this._backgroundSizeToScaleMode(style.backgroundSize)
          });
        }
      }
    }
    
    return fills;
  },
  
  /**
   * Extracts stroke information from element style
   * @private
   */
  _extractStrokes(style) {
    const strokes = [];
    
    if (style.borderWidth && style.borderWidth !== '0px') {
      // Parse border color
      const borderColor = this._parseColor(style.borderColor || 'rgb(0, 0, 0)');
      
      if (borderColor) {
        strokes.push({
          type: 'SOLID',
          color: {
            r: borderColor.r / 255,
            g: borderColor.g / 255,
            b: borderColor.b / 255
          },
          opacity: borderColor.a,
          strokeWeight: parseInt(style.borderWidth) || 1,
          strokeAlign: 'CENTER'
        });
      }
    }
    
    return strokes;
  },
  
  /**
   * Extracts additional properties from element style
   * @private
   */
  _extractProperties(element, style) {
    const properties = {
      cornerRadius: this._extractCornerRadius(style),
      effects: this._extractEffects(style),
      layout: this._extractLayoutProperties(element, style)
    };
    
    // Extract component-specific properties based on element type
    if (element.tagName.toLowerCase() === 'button') {
      properties.buttonType = element.type || 'button';
    }
    
    return properties;
  },
  
  /**
   * Extracts corner radius information
   * @private
   */
  _extractCornerRadius(style) {
    if (!style.borderRadius || style.borderRadius === '0px') return 0;
    
    // Handle single value border radius
    if (!style.borderRadius.includes(' ')) {
      return parseFloat(style.borderRadius);
    }
    
    // Handle complex border radius with multiple values
    const values = style.borderRadius.split(' ').map(v => parseFloat(v));
    
    // Return average as a simple approximation
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  },
  
  /**
   * Extracts shadow and blur effects
   * @private
   */
  _extractEffects(style) {
    const effects = [];
    
    // Extract box shadow
    if (style.boxShadow && style.boxShadow !== 'none') {
      try {
        // Parse box shadow - this is simplified
        // Example: "0px 4px 8px rgba(0, 0, 0, 0.1)"
        const shadowParts = style.boxShadow.split(' ');
        
        // Extract values from shadow parts
        const offsetX = parseFloat(shadowParts[0]) || 0;
        const offsetY = parseFloat(shadowParts[1]) || 0;
        const blur = parseFloat(shadowParts[2]) || 0;
        const spread = shadowParts.length > 3 ? parseFloat(shadowParts[3]) || 0 : 0;
        
        // Extract color
        const colorMatch = style.boxShadow.match(/rgba?\([^)]+\)/);
        const shadowColor = colorMatch ? this._parseColor(colorMatch[0]) : { r: 0, g: 0, b: 0, a: 0.2 };
        
        // Add drop shadow effect
        effects.push({
          type: 'DROP_SHADOW',
          color: {
            r: shadowColor.r / 255,
            g: shadowColor.g / 255,
            b: shadowColor.b / 255,
            a: shadowColor.a
          },
          offset: { x: offsetX, y: offsetY },
          radius: blur,
          spread: spread,
          visible: true,
          blendMode: 'NORMAL'
        });
      } catch (e) {
        console.error('Error parsing box shadow:', e);
      }
    }
    
    return effects;
  },
  
  /**
   * Extract only essential CSS properties needed for Figma component creation
   * Carefully limits what's captured to prevent data bloat
   * @private
   */
  _extractProperties(element, computedStyle) {
    try {
      // Start with a minimal set of properties, only include non-default values
      const properties = {};
      
      // Only include opacity if it's not 1 (default)
      const opacity = parseFloat(computedStyle.opacity);
      if (opacity && opacity !== 1) {
        properties.opacity = opacity;
      }
      
      // Only extract border radius if it's not 0
      const cornerRadius = this._extractCornerRadius(computedStyle);
      if (cornerRadius && cornerRadius > 0) {
        properties.cornerRadius = cornerRadius;
      }
      
      // Effects like shadows - only if present
      const effects = this._extractEffects(computedStyle);
      if (effects && effects.length > 0) {
        // Limit to maximum of 3 effects
        properties.effects = effects.slice(0, 3);
      }
      
      // Only include layout properties that differ from defaults
      if (computedStyle.display && computedStyle.display !== 'block') {
        properties.display = computedStyle.display;
      }
      
      if (computedStyle.position && computedStyle.position !== 'static') {
        properties.position = computedStyle.position;
      }
      
      if (computedStyle.overflow && computedStyle.overflow !== 'visible') {
        properties.overflow = computedStyle.overflow;
      }
      
      // Add padding only if any value is greater than 0
      const paddingTop = parseInt(computedStyle.paddingTop) || 0;
      const paddingRight = parseInt(computedStyle.paddingRight) || 0;
      const paddingBottom = parseInt(computedStyle.paddingBottom) || 0;
      const paddingLeft = parseInt(computedStyle.paddingLeft) || 0;
      
      if (paddingTop > 0 || paddingRight > 0 || paddingBottom > 0 || paddingLeft > 0) {
        properties.padding = {
          top: paddingTop,
          right: paddingRight,
          bottom: paddingBottom,
          left: paddingLeft
        };
      }
      
      // Add margin only if any value is not 0
      const marginTop = parseInt(computedStyle.marginTop) || 0;
      const marginRight = parseInt(computedStyle.marginRight) || 0;
      const marginBottom = parseInt(computedStyle.marginBottom) || 0;
      const marginLeft = parseInt(computedStyle.marginLeft) || 0;
      
      if (marginTop !== 0 || marginRight !== 0 || marginBottom !== 0 || marginLeft !== 0) {
        properties.margin = {
          top: marginTop,
          right: marginRight,
          bottom: marginBottom,
          left: marginLeft
        };
      }
      
      return properties;
    } catch (error) {
      console.error('Error extracting properties:', error);
      return {}; // Return empty object on error rather than crashing
    }
  },
  
  /**
   * Estimates spacing between children in a flex container
   * @private
   */
  _estimateSpacingBetweenChildren(element, style) {
    // Start with gap property if available (modern flexbox)
    if (style.gap && style.gap !== '0px') {
      return parseFloat(style.gap);
    }
    
    // If no gap property, try to estimate from layout
    const children = element.children;
    if (!children || children.length <= 1) return 0;
    
    let totalSpacing = 0;
    let spacingPoints = 0;
    
    const isHorizontal = style.flexDirection === 'row' || style.flexDirection === 'row-reverse';
    
    // Loop through adjacent children to measure gaps
    for (let i = 1; i < children.length; i++) {
      const prevChild = children[i - 1];
      const currChild = children[i];
      
      const prevRect = prevChild.getBoundingClientRect();
      const currRect = currChild.getBoundingClientRect();
      
      if (isHorizontal) {
        const spacing = currRect.left - (prevRect.left + prevRect.width);
        if (spacing > 0) { // Only count positive spacing
          totalSpacing += spacing;
          spacingPoints++;
        }
      } else {
        const spacing = currRect.top - (prevRect.top + prevRect.height);
        if (spacing > 0) {
          totalSpacing += spacing;
          spacingPoints++;
        }
      }
    }
    
    // Return average spacing or 0 if none found
    return spacingPoints > 0 ? totalSpacing / spacingPoints : 0;
  },
  
  /**
   * Maps CSS flex alignment to Figma alignment
   * @private
   */
  _mapFlexAlignment(style) {
    // Primary axis alignment (justify-content)
    let primaryAxisAlignment = 'MIN';
    switch (style.justifyContent) {
      case 'center': primaryAxisAlignment = 'CENTER'; break;
      case 'flex-end': primaryAxisAlignment = 'MAX'; break;
      case 'space-between': primaryAxisAlignment = 'SPACE_BETWEEN'; break;
      case 'space-around': primaryAxisAlignment = 'SPACE_AROUND'; break;
    }
    
    // Counter axis alignment (align-items)
    let counterAxisAlignment = 'MIN';
    switch (style.alignItems) {
      case 'center': counterAxisAlignment = 'CENTER'; break;
      case 'flex-end': counterAxisAlignment = 'MAX'; break;
      case 'stretch': counterAxisAlignment = 'STRETCH'; break;
    }
    
    return {
      primaryAxis: primaryAxisAlignment,
      counterAxis: counterAxisAlignment
    };
  },
  
  /**
   * Extracts typography information from text elements
   * @private
   */
  _extractTypography(element, style, rect) {
    return {
      text: element.textContent || '',
      fontName: {
        family: this._extractFontFamily(style.fontFamily),
        style: this._determineFontStyle(style)
      },
      fontSize: parseFloat(style.fontSize),
      fontWeight: parseInt(style.fontWeight) || 400,
      letterSpacing: parseFloat(style.letterSpacing) || 0,
      lineHeight: this._extractLineHeight(style),
      textAlignHorizontal: this._mapTextAlign(style.textAlign),
      textAlignVertical: this._mapVerticalAlign(style.verticalAlign),
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
  },
  
  /**
   * Extracts font family from CSS fontFamily property
   * @private
   */
  _extractFontFamily(fontFamily) {
    if (!fontFamily) return 'Inter';
    
    // Remove quotes and get first font in stack
    return fontFamily
      .replace(/["']/g, '')
      .split(',')[0]
      .trim();
  },
  
  /**
   * Determines font style based on weight and style
   * @private
   */
  _determineFontStyle(style) {
    const weight = parseInt(style.fontWeight) || 400;
    const isItalic = style.fontStyle === 'italic';
    
    if (isItalic) {
      if (weight >= 700) return 'Bold Italic';
      if (weight >= 500) return 'Medium Italic';
      return 'Italic';
    } else {
      if (weight >= 800) return 'Black';
      if (weight >= 700) return 'Bold';
      if (weight >= 600) return 'SemiBold';
      if (weight >= 500) return 'Medium';
      if (weight <= 300) return 'Light';
      if (weight <= 200) return 'ExtraLight';
      return 'Regular';
    }
  },
  
  /**
   * Extracts line height information
   * @private
   */
  _extractLineHeight(style) {
    if (style.lineHeight === 'normal') {
      // Approximate normal line height as 1.2x font size
      return parseFloat(style.fontSize) * 1.2;
    }
    
    // Handle percentage values
    if (style.lineHeight.endsWith('%')) {
      const percentage = parseFloat(style.lineHeight) / 100;
      return parseFloat(style.fontSize) * percentage;
    }
    
    // Handle absolute values
    return parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
  },
  
  /**
   * Maps CSS text-align to Figma textAlignHorizontal
   * @private
   */
  _mapTextAlign(textAlign) {
    switch (textAlign) {
      case 'center': return 'CENTER';
      case 'right': return 'RIGHT';
      case 'justify': return 'JUSTIFIED';
      default: return 'LEFT';
    }
  },
  
  /**
   * Maps CSS vertical-align to Figma textAlignVertical
   * @private
   */
  _mapVerticalAlign(verticalAlign) {
    switch (verticalAlign) {
      case 'middle': return 'CENTER';
      case 'bottom': return 'BOTTOM';
      default: return 'TOP';
    }
  },
  
  /**
   * Checks if element is a text node
   * @private
   */
  _isTextElement(element) {
    const tagName = element.tagName.toLowerCase();
    const textTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'label', 'a'];
    
    return textTags.includes(tagName) || 
           (element.childNodes.length === 1 && element.childNodes[0].nodeType === 3);
  },
  
  /**
   * Checks if element is visible
   * @private
   */
  _isElementVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetWidth > 0 &&
           element.offsetHeight > 0;
  },
  
  /**
   * Generates a clean, semantic name for the element, avoiding problematic Tailwind classes
   * @private
   */
  _generateElementName(element) {
    const tagName = element.tagName.toLowerCase();
    let componentName = '';
    
    try {
      // First priority: Use semantic attributes that identify the component
      const testId = element.getAttribute('data-testid') || 
                    element.getAttribute('data-test-id') || 
                    element.getAttribute('data-cy') ||
                    element.getAttribute('data-component') ||
                    element.getAttribute('data-element-name');
      
      if (testId) {
        // Clean up test IDs (they're usually the most semantic names)
        componentName = this._toTitleCase(testId.replace(/-/g, ' ').replace(/[_\.]/g, ' '));
        return componentName.length > 24 ? componentName.substring(0, 21) + '...' : componentName;
      }
      
      // Second priority: Use accessible names for interactive elements
      if (tagName === 'button' || tagName === 'a' || element.getAttribute('role') === 'button' || 
          tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
          
        // Check for accessible name attributes
        const accessibleName = element.getAttribute('aria-label') ||
                              element.getAttribute('title') ||
                              element.getAttribute('name') ||
                              element.getAttribute('alt');
                              
        if (accessibleName) {
          componentName = this._toTitleCase(accessibleName);
          return componentName.length > 24 ? `${componentName.substring(0, 21)}...` : componentName;
        }
        
        // Use text content for buttons
        if (element.textContent && element.textContent.trim()) {
          const text = element.textContent.trim();
          componentName = text.length > 15 ? `${text.substring(0, 12)}... ${tagName}` : `${text} ${tagName}`;
          return componentName;
        }
        
        // Generic component name based on type
        return `${this._toTitleCase(tagName)}`;
      }
      
      // Third priority: Use element ID if available and not too long
      if (element.id && element.id.length < 25 && !element.id.includes('[') && !element.id.includes(':')) {
        componentName = this._toTitleCase(element.id.replace(/-/g, ' ').replace(/[_\.]/g, ' '));
        return componentName.length > 24 ? componentName.substring(0, 21) + '...' : componentName;
      }
      
      // Fourth priority: Use element role or type-specific attributes
      if (element.getAttribute('role')) {
        return `${this._toTitleCase(element.getAttribute('role'))} ${tagName}`;
      }
      
      // Fifth priority: Find short, meaningful class names (avoid Tailwind utility classes)
      if (element.className && typeof element.className === 'string' && element.className.trim()) {
        // Get meaningful class names while explicitly filtering out utility classes
        // that contain problematic characters like [, ], : that break JSON
        const classNames = element.className.trim().split(/\s+/);
        
        // Filter to only include simple, semantic class names
        const semanticClasses = classNames.filter(cls => 
          // Exclude classes containing special characters commonly found in utility classes
          !cls.includes(':') && !cls.includes('[') && !cls.includes(']') && 
          // Exclude classes that are too long (likely utility classes)
          cls.length < 20 &&
          // Exclude common utility class prefixes
          !cls.startsWith('w-') && !cls.startsWith('h-') && !cls.startsWith('p-') && 
          !cls.startsWith('m-') && !cls.startsWith('text-') && !cls.startsWith('bg-') && 
          !cls.startsWith('flex-') && !cls.startsWith('grid-')
        ).slice(0, 1); // Only take at most one semantic class name
        
        if (semanticClasses.length > 0) {
          componentName = this._toTitleCase(semanticClasses[0].replace(/-/g, ' ').replace(/[_\.]/g, ' '));
          return componentName.length > 24 ? componentName.substring(0, 21) + '...' : componentName;
        }
      }
      
      // Final fallback: Use element type with a unique identifier to avoid conflicts
      componentName = `${this._toTitleCase(tagName)} Element`;
      return componentName;
    } catch (error) {
      console.error('Error generating element name:', error);
      return `${tagName} Element`; // Ultra-safe fallback
    }
  },
  
  /**
   * Generates a unique ID for the element
   * @private
   */
  _generateElementId(element) {
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? element.id : '';
    const classNames = element.className && typeof element.className === 'string' ? 
                       element.className.trim().replace(/\s+/g, '-') : '';
    
    // Create a unique identifier
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000);
    
    return `${tagName}${id ? `-${id}` : ''}${classNames ? `-${classNames}` : ''}-${timestamp}-${random}`;
  },
  
  /**
   * Converts a string to Title Case
   * @private
   */
  _toTitleCase(str) {
    return str.replace(/\w\S*/g, txt => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  },
  
  /**
   * Parses a CSS color string and returns RGBA values
   * @private
   */
  _parseColor(colorStr) {
    // Handle named colors
    if (!colorStr.includes('rgb') && !colorStr.includes('rgba') && !colorStr.includes('#')) {
      const tempElem = document.createElement('div');
      tempElem.style.color = colorStr;
      document.body.appendChild(tempElem);
      const computedColor = window.getComputedStyle(tempElem).color;
      document.body.removeChild(tempElem);
      colorStr = computedColor;
    }
    
    // Handle hex
    if (colorStr.startsWith('#')) {
      return this._hexToRgba(colorStr);
    }
    
    // Handle rgb/rgba
    const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1], 10),
        g: parseInt(rgbMatch[2], 10),
        b: parseInt(rgbMatch[3], 10),
        a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
      };
    }
    
    // Default fallback
    return { r: 0, g: 0, b: 0, a: 1 };
  },
  
  /**
   * Converts hex color to RGBA
   * @private
   */
  _hexToRgba(hex) {
    hex = hex.replace('#', '');
    
    // Handle shorthand hex
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1
    };
  },
  
  /**
   * Extracts URL from background-image CSS value
   * @private
   */
  _extractUrlFromBackground(backgroundImage) {
    const urlMatch = backgroundImage.match(/url\(['"]?([^'")]+)['"]?\)/);
    return urlMatch ? urlMatch[1] : null;
  },
  
  /**
   * Maps CSS background-size to Figma scale mode
   * @private
   */
  _backgroundSizeToScaleMode(backgroundSize) {
    switch (backgroundSize) {
      case 'cover': return 'FILL';
      case 'contain': return 'FIT';
      default: return 'FILL';
    }
  },
  
  /**
   * Compare two component states to detect meaningful differences
   * @private
   */
  _statesAreDifferent(state1, state2) {
    // Check for differences in fills
    const fillsDifferent = JSON.stringify(state1.fills) !== JSON.stringify(state2.fills);
    
    // Check for differences in strokes
    const strokesDifferent = JSON.stringify(state1.strokes) !== JSON.stringify(state2.strokes);
    
    // Check for differences in effects
    const effectsDifferent = JSON.stringify(state1.properties?.effects) !== 
                           JSON.stringify(state2.properties?.effects);
    
    return fillsDifferent || strokesDifferent || effectsDifferent;
  }
};

// Export the module
if (typeof module !== 'undefined') {
  module.exports = DOMCrawler;
} else {
  window.DOMCrawler = DOMCrawler;
}
