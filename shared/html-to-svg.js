/**
 * HTML to SVG Converter
 * Converts HTML elements to SVG that can be pasted directly into Figma
 * and maintain their structure as editable Figma objects
 */

const HTMLtoSVG = {
  /**
   * Convert an HTML element to an SVG string representation
   * @param {HTMLElement} element - The element to convert
   * @param {Object} options - Configuration options
   * @returns {string} SVG string representation
   */
  convertElementToSVG(element, options = {}) {
    if (!element) {
      throw new Error('No element provided for conversion');
    }
    
    // Get the element's position and size
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    
    // Create the SVG container with the right dimensions
    const svgWidth = Math.ceil(rect.width);
    const svgHeight = Math.ceil(rect.height);
    
    let svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`;
    
    // Add a description for Figma to identify this as a component
    svgString += `<desc>Sticker Component - ${element.tagName}${element.id ? ' #' + element.id : ''}${element.className ? ' .' + element.className.replace(/\s+/g, '.') : ''}</desc>`;
    
    // Convert the element and its children to SVG
    svgString += this._processElement(element, {
      x: 0, 
      y: 0, 
      width: svgWidth,
      height: svgHeight,
      parentX: -rect.left,
      parentY: -rect.top
    });
    
    // Close the SVG tag
    svgString += '</svg>';
    
    return svgString;
  },
  
  /**
   * Process a single element and its children recursively
   * @private
   */
  _processElement(element, layout) {
    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    // Calculate position relative to the SVG viewBox
    const x = rect.left + layout.parentX;
    const y = rect.top + layout.parentY;
    const width = rect.width;
    const height = rect.height;
    
    let elementSvg = '';
    
    // Create a group for this element and its children
    elementSvg += `<g id="${this._generateElementId(element)}">`;
    
    // 1. Create background/container rectangle if needed
    if (this._hasVisualBox(styles)) {
      const rectAttributes = this._getRectangleAttributes(styles, x, y, width, height);
      elementSvg += `<rect ${rectAttributes.join(' ')} />`;
      
      // Add borders if present
      elementSvg += this._createBorders(styles, x, y, width, height);
    }
    
    // 2. Add text content if this is a text node
    if (this._isTextNode(element) && element.textContent.trim()) {
      elementSvg += this._createTextElement(element, styles, x, y, width, height);
    }
    
    // 3. Add background image if present
    const backgroundImage = this._extractBackgroundImage(styles);
    if (backgroundImage) {
      elementSvg += this._createBackgroundImage(backgroundImage, x, y, width, height);
    }
    
    // 4. Handle actual img elements
    if (element.tagName.toLowerCase() === 'img' && element.src) {
      elementSvg += this._createImageElement(element, x, y, width, height);
    }
    
    // 5. Process children recursively
    if (element.childNodes) {
      for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes[i];
        if (child.nodeType === 1) { // Element node
          elementSvg += this._processElement(child, {
            x,
            y,
            width,
            height,
            parentX: layout.parentX,
            parentY: layout.parentY
          });
        }
      }
    }
    
    // Close the group
    elementSvg += '</g>';
    
    return elementSvg;
  },
  
  /**
   * Determines if an element has visual box properties (background, border, etc)
   * @private
   */
  _hasVisualBox(styles) {
    return (
      styles.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
      styles.border !== '0px none rgb(0, 0, 0)' ||
      styles.boxShadow !== 'none'
    );
  },
  
  /**
   * Generates SVG rectangle attributes from CSS styles
   * @private
   */
  _getRectangleAttributes(styles, x, y, width, height) {
    const attributes = [
      `x="${x}"`,
      `y="${y}"`,
      `width="${width}"`,
      `height="${height}"`
    ];
    
    // Background color
    if (styles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      attributes.push(`fill="${styles.backgroundColor}"`);
    } else {
      attributes.push('fill="none"');
    }
    
    // Border radius
    if (styles.borderRadius !== '0px') {
      const radius = parseFloat(styles.borderRadius);
      attributes.push(`rx="${radius}"`);
      attributes.push(`ry="${radius}"`);
    }
    
    // Opacity
    if (styles.opacity !== '1') {
      attributes.push(`opacity="${styles.opacity}"`);
    }
    
    // Box shadow
    if (styles.boxShadow !== 'none') {
      const shadowId = `shadow-${Math.random().toString(36).substring(2, 11)}`;
      attributes.push(`filter="url(#${shadowId})"`);
      
      // Create the shadow filter - will need to be added to defs
      // This is simplified - a real implementation would parse the box-shadow value
      const shadowDef = `
        <defs>
          <filter id="${shadowId}" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.3"/>
          </filter>
        </defs>
      `;
      
      // Add the shadow definition to the attributes array
      // In a real implementation, these would be collected and added to the SVG root
      attributes.push(`data-shadow-def="${shadowDef}"`);
    }
    
    return attributes;
  },
  
  /**
   * Creates SVG border elements from CSS styles
   * @private
   */
  _createBorders(styles, x, y, width, height) {
    let borderSvg = '';
    
    // This is simplified - a real implementation would handle individual borders
    if (styles.border && styles.border !== '0px none rgb(0, 0, 0)') {
      const borderWidth = parseFloat(styles.borderWidth || '1');
      const borderColor = styles.borderColor || '#000';
      
      borderSvg += `<rect 
        x="${x + borderWidth/2}" 
        y="${y + borderWidth/2}" 
        width="${width - borderWidth}" 
        height="${height - borderWidth}"
        fill="none"
        stroke="${borderColor}"
        stroke-width="${borderWidth}"
      />`;
    }
    
    return borderSvg;
  },
  
  /**
   * Determines if an element is primarily a text node
   * @private
   */
  _isTextNode(element) {
    const tagName = element.tagName.toLowerCase();
    return (
      tagName === 'p' ||
      tagName === 'h1' ||
      tagName === 'h2' ||
      tagName === 'h3' ||
      tagName === 'h4' ||
      tagName === 'h5' ||
      tagName === 'h6' ||
      tagName === 'span' ||
      tagName === 'label' ||
      tagName === 'a' ||
      (element.childNodes.length === 1 && element.childNodes[0].nodeType === 3)
    );
  },
  
  /**
   * Creates an SVG text element from an HTML text element
   * @private
   */
  _createTextElement(element, styles, x, y, width, height) {
    const textContent = element.textContent.trim();
    const fontSize = parseFloat(styles.fontSize);
    const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.2;
    
    // Calculate vertical positioning - this is simplified
    // A real implementation would handle vertical-align, text-baseline, etc.
    let textY;
    
    switch (styles.verticalAlign) {
      case 'top':
        textY = y + fontSize; // Approximately the text baseline from the top
        break;
      case 'bottom':
        textY = y + height - (lineHeight - fontSize);
        break;
      default: // middle or other
        textY = y + height / 2 + fontSize / 2;
    }
    
    // Get horizontal alignment
    let textAnchor;
    let textX;
    
    switch (styles.textAlign) {
      case 'center':
        textAnchor = 'middle';
        textX = x + width / 2;
        break;
      case 'right':
      case 'end':
        textAnchor = 'end';
        textX = x + width - parseFloat(styles.paddingRight || '0');
        break;
      default: // left, start, or default
        textAnchor = 'start';
        textX = x + parseFloat(styles.paddingLeft || '0');
    }
    
    // Text styling attributes
    const textAttributes = [
      `x="${textX}"`,
      `y="${textY}"`,
      `font-family="${styles.fontFamily.replace(/['"]/g, '')}"`,
      `font-size="${fontSize}px"`,
      `fill="${styles.color}"`,
      `text-anchor="${textAnchor}"`
    ];
    
    // Add font weight if not normal
    if (styles.fontWeight !== '400' && styles.fontWeight !== 'normal') {
      textAttributes.push(`font-weight="${styles.fontWeight}"`);
    }
    
    // Add font style if italic
    if (styles.fontStyle === 'italic') {
      textAttributes.push('font-style="italic"');
    }
    
    // Add text decoration if present
    if (styles.textDecoration !== 'none') {
      textAttributes.push(`text-decoration="${styles.textDecoration}"`);
    }
    
    // Handle multi-line text with tspan elements
    if (textContent.includes('\n')) {
      let tspans = '';
      const lines = textContent.split('\n');
      
      lines.forEach((line, index) => {
        tspans += `<tspan x="${textX}" dy="${index === 0 ? 0 : lineHeight}px">${this._escapeXml(line)}</tspan>`;
      });
      
      return `<text ${textAttributes.join(' ')}>${tspans}</text>`;
    }
    
    return `<text ${textAttributes.join(' ')}>${this._escapeXml(textContent)}</text>`;
  },
  
  /**
   * Extracts background image URL from CSS styles
   * @private
   */
  _extractBackgroundImage(styles) {
    if (styles.backgroundImage && styles.backgroundImage !== 'none') {
      // Extract URL from the background-image style
      const match = styles.backgroundImage.match(/url\(['"]?([^'")]+)['"]?\)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  },
  
  /**
   * Creates an SVG image element for CSS background images
   * @private
   */
  _createBackgroundImage(imageUrl, x, y, width, height) {
    // Note: In a real implementation, we'd convert the image to a data URI
    // Here, we're just using the URL directly, which may not work in an SVG
    return `<image href="${imageUrl}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${this._getBackgroundSizing(styles)}" />`;
  },
  
  /**
   * Creates an SVG image element for HTML img elements
   * @private
   */
  _createImageElement(imgElement, x, y, width, height) {
    return `<image href="${imgElement.src}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />`;
  },
  
  /**
   * Maps CSS background-size to SVG preserveAspectRatio
   * @private
   */
  _getBackgroundSizing(styles) {
    switch (styles.backgroundSize) {
      case 'cover':
        return 'xMidYMid slice';
      case 'contain':
        return 'xMidYMid meet';
      default:
        return 'none';  // For "auto" or specific dimensions
    }
  },
  
  /**
   * Generates a unique ID for an element based on its attributes
   * @private
   */
  _generateElementId(element) {
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? element.id : '';
    const className = element.className ? element.className.replace(/\s+/g, '-') : '';
    
    return `el-${tagName}${id ? '-' + id : ''}${className ? '-' + className : ''}-${Math.random().toString(36).substring(2, 7)}`;
  },
  
  /**
   * Escape XML special characters to prevent SVG markup issues
   * @private
   */
  _escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  },
  
  /**
   * Copies an element as SVG to the clipboard
   * @param {HTMLElement} element - The element to copy
   * @returns {Promise<boolean>} - Whether the copy was successful
   */
  async copyElementAsSVG(element) {
    if (!element) {
      throw new Error('No element provided to copy');
    }
    
    try {
      // Generate SVG string
      const svgString = this.convertElementToSVG(element);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(svgString);
      
      return true;
    } catch (error) {
      console.error('Error copying element as SVG:', error);
      return false;
    }
  },
  
  /**
   * Helper to copy element by selector
   * @param {string} selector - CSS selector for the element
   * @returns {Promise<boolean>} - Whether the copy was successful
   */
  async copyElementBySelectorAsSVG(selector) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`No element found matching selector: ${selector}`);
    }
    
    return this.copyElementAsSVG(element);
  }
};

// Export based on environment
if (typeof module !== 'undefined') {
  module.exports = HTMLtoSVG;
} else {
  window.HTMLtoSVG = HTMLtoSVG;
}
