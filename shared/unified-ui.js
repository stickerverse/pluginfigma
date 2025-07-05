/**
 * Sticker Unified Component System - UI Integration Layer
 * Shared UI components and logic for both Chrome extension and Figma plugin
 */

// Import core if available
const Core = window.StickerCore || {};

// UI component registry
const UIComponents = {
  components: {},
  
  // Register a UI component with a unique name
  register(name, component) {
    this.components[name] = component;
    return component;
  },
  
  // Get a component by name
  get(name) {
    return this.components[name];
  },
  
  // Initialize all components in a container
  initializeAll(container) {
    Object.values(this.components).forEach(component => {
      if (typeof component.initialize === 'function') {
        component.initialize(container);
      }
    });
  }
};

// Image upload component
UIComponents.register('ImageUpload', {
  initialize(container) {
    const uploadElement = container.querySelector('.image-upload') || this.createUploadElement(container);
    
    if (uploadElement) {
      uploadElement.addEventListener('drop', this.handleDrop.bind(this));
      uploadElement.addEventListener('dragover', this.handleDragOver.bind(this));
      
      const fileInput = uploadElement.querySelector('input[type="file"]');
      if (fileInput) {
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
      }
    }
  },
  
  createUploadElement(container) {
    const uploadDiv = document.createElement('div');
    uploadDiv.className = 'image-upload';
    uploadDiv.innerHTML = `
      <div class="upload-area">
        <div class="upload-icon">+</div>
        <p>Drag and drop an image here, or click to select</p>
        <input type="file" class="file-input" accept="image/*" />
      </div>
      <div class="preview-container" style="display: none">
        <img class="image-preview" src="" alt="Preview" />
        <button class="remove-btn">×</button>
      </div>
    `;
    
    container.appendChild(uploadDiv);
    
    const uploadArea = uploadDiv.querySelector('.upload-area');
    const fileInput = uploadDiv.querySelector('input[type="file"]');
    
    uploadArea.addEventListener('click', () => {
      fileInput.click();
    });
    
    const removeBtn = uploadDiv.querySelector('.remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearPreview(uploadDiv);
      });
    }
    
    return uploadDiv;
  },
  
  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    this.processFiles(e.dataTransfer.files);
  },
  
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  },
  
  handleFileSelect(e) {
    this.processFiles(e.target.files);
  },
  
  processFiles(files) {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.type.match('image.*')) {
      this.showError('Please select an image file');
      return;
    }
    
    this.showPreview(file);
    
    // Notify via core messenger if available
    if (Core.Messenger) {
      Core.Messenger.send('IMAGE_SELECTED', { file });
    }
    
    // Dispatch custom event for environments without Core
    const event = new CustomEvent('sticker:image-selected', { 
      detail: { file } 
    });
    document.dispatchEvent(event);
  },
  
  showPreview(file) {
    const uploadElement = document.querySelector('.image-upload');
    if (!uploadElement) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const uploadArea = uploadElement.querySelector('.upload-area');
      const previewContainer = uploadElement.querySelector('.preview-container');
      const imagePreview = uploadElement.querySelector('.image-preview');
      
      if (uploadArea && previewContainer && imagePreview) {
        uploadArea.style.display = 'none';
        previewContainer.style.display = 'block';
        imagePreview.src = e.target.result;
      }
    };
    
    reader.readAsDataURL(file);
  },
  
  clearPreview(uploadElement) {
    const uploadArea = uploadElement.querySelector('.upload-area');
    const previewContainer = uploadElement.querySelector('.preview-container');
    const fileInput = uploadElement.querySelector('input[type="file"]');
    
    if (uploadArea && previewContainer && fileInput) {
      uploadArea.style.display = 'block';
      previewContainer.style.display = 'none';
      fileInput.value = '';
    }
    
    // Notify via core messenger if available
    if (Core.Messenger) {
      Core.Messenger.send('IMAGE_CLEARED', {});
    }
    
    // Dispatch custom event
    const event = new CustomEvent('sticker:image-cleared');
    document.dispatchEvent(event);
  },
  
  showError(message) {
    // Create or update error display
    let errorDisplay = document.querySelector('.upload-error');
    
    if (!errorDisplay) {
      errorDisplay = document.createElement('div');
      errorDisplay.className = 'upload-error';
      
      const uploadElement = document.querySelector('.image-upload');
      if (uploadElement) {
        uploadElement.appendChild(errorDisplay);
      }
    }
    
    errorDisplay.textContent = message;
    errorDisplay.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorDisplay.style.display = 'none';
    }, 5000);
  }
});

// JSON Import component
UIComponents.register('JsonImport', {
  initialize(container) {
    const jsonImportElement = container.querySelector('.json-import') || this.createJsonImportElement(container);
    
    if (jsonImportElement) {
      const pasteButton = jsonImportElement.querySelector('.paste-button');
      if (pasteButton) {
        pasteButton.addEventListener('click', this.handlePasteClick.bind(this));
      }
      
      const textarea = jsonImportElement.querySelector('textarea');
      if (textarea) {
        textarea.addEventListener('input', this.handleTextareaChange.bind(this));
      }
      
      const fileInput = jsonImportElement.querySelector('input[type="file"]');
      if (fileInput) {
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
      }
    }
  },
  
  createJsonImportElement(container) {
    const jsonImportDiv = document.createElement('div');
    jsonImportDiv.className = 'json-import';
    jsonImportDiv.innerHTML = `
      <div class="import-options">
        <button class="paste-button">Paste from Clipboard</button>
        <div class="or-divider">OR</div>
        <label class="file-select-label">
          Select JSON File
          <input type="file" accept="application/json" style="display: none" />
        </label>
      </div>
      <textarea class="json-textarea" placeholder="Paste JSON data here..."></textarea>
      <div class="json-preview" style="display: none">
        <div class="json-icon">✓</div>
        <div class="json-status">JSON data loaded</div>
        <button class="clear-json-btn">Clear</button>
      </div>
    `;
    
    container.appendChild(jsonImportDiv);
    
    const fileLabel = jsonImportDiv.querySelector('.file-select-label');
    const fileInput = jsonImportDiv.querySelector('input[type="file"]');
    
    if (fileLabel && fileInput) {
      fileLabel.addEventListener('click', () => {
        fileInput.click();
      });
    }
    
    const clearBtn = jsonImportDiv.querySelector('.clear-json-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', this.clearJsonData.bind(this));
    }
    
    return jsonImportDiv;
  },
  
  async handlePasteClick() {
    try {
      // Try to read from clipboard
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        this.processJsonText(text);
      } else {
        this.showError('Clipboard access not available. Please paste manually into the textarea.');
      }
    } catch (error) {
      console.error('Clipboard error:', error);
      this.showError('Could not access clipboard. Please paste manually.');
    }
  },
  
  handleTextareaChange(e) {
    const text = e.target.value.trim();
    if (text) {
      this.processJsonText(text);
    }
  },
  
  handleFileSelect(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.type.match('application/json')) {
      this.showError('Please select a JSON file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      this.processJsonText(text);
    };
    
    reader.onerror = () => {
      this.showError('Error reading JSON file');
    };
    
    reader.readAsText(file);
  },
  
  processJsonText(text) {
    if (!text) {
      this.showError('No data found');
      return;
    }
    
    try {
      // Attempt to parse JSON
      const jsonData = JSON.parse(text);
      
      // Validate structure
      if (!this.validateJsonStructure(jsonData)) {
        this.showError('Invalid JSON structure for component data');
        return;
      }
      
      // Update UI
      this.showJsonLoaded(jsonData);
      
      // Notify via core messenger
      if (Core.Messenger) {
        Core.Messenger.send('JSON_DATA_LOADED', { jsonData });
      }
      
      // Dispatch custom event
      const event = new CustomEvent('sticker:json-loaded', { 
        detail: { jsonData } 
      });
      document.dispatchEvent(event);
      
    } catch (error) {
      console.error('JSON parse error:', error);
      this.showError('Invalid JSON format: ' + error.message);
    }
  },
  
  validateJsonStructure(jsonData) {
    // Basic validation - can be expanded
    return jsonData && 
      (jsonData.imageAnalysis || 
       (jsonData.components || jsonData.colors || jsonData.typography));
  },
  
  showJsonLoaded(jsonData) {
    const jsonImport = document.querySelector('.json-import');
    if (!jsonImport) return;
    
    const textarea = jsonImport.querySelector('.json-textarea');
    const preview = jsonImport.querySelector('.json-preview');
    const status = jsonImport.querySelector('.json-status');
    
    if (textarea && preview && status) {
      textarea.style.display = 'none';
      preview.style.display = 'block';
      
      // Count items in the JSON data
      let componentCount = 0;
      let colorCount = 0;
      let textCount = 0;
      
      if (jsonData.imageAnalysis) {
        componentCount = jsonData.imageAnalysis.components?.length || 0;
        colorCount = jsonData.imageAnalysis.colors?.length || 0;
        textCount = jsonData.imageAnalysis.typography?.length || 0;
      } else {
        componentCount = jsonData.components?.length || 0;
        colorCount = jsonData.colors?.length || 0;
        textCount = jsonData.typography?.length || 0;
      }
      
      status.textContent = `JSON loaded: ${componentCount} components, ${colorCount} colors, ${textCount} text elements`;
    }
    
    // Hide other import options
    const importOptions = jsonImport.querySelector('.import-options');
    if (importOptions) {
      importOptions.style.display = 'none';
    }
  },
  
  clearJsonData() {
    const jsonImport = document.querySelector('.json-import');
    if (!jsonImport) return;
    
    const textarea = jsonImport.querySelector('.json-textarea');
    const preview = jsonImport.querySelector('.json-preview');
    const importOptions = jsonImport.querySelector('.import-options');
    
    if (textarea && preview && importOptions) {
      textarea.style.display = 'block';
      textarea.value = '';
      preview.style.display = 'none';
      importOptions.style.display = 'flex';
    }
    
    // Notify via core messenger
    if (Core.Messenger) {
      Core.Messenger.send('JSON_DATA_CLEARED', {});
    }
    
    // Dispatch custom event
    const event = new CustomEvent('sticker:json-cleared');
    document.dispatchEvent(event);
  },
  
  showError(message) {
    // Create or update error display
    let errorDisplay = document.querySelector('.json-error');
    
    if (!errorDisplay) {
      errorDisplay = document.createElement('div');
      errorDisplay.className = 'json-error';
      
      const jsonImport = document.querySelector('.json-import');
      if (jsonImport) {
        jsonImport.appendChild(errorDisplay);
      }
    }
    
    errorDisplay.textContent = message;
    errorDisplay.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorDisplay.style.display = 'none';
    }, 5000);
  }
});

// Export the UI system
const UnifiedUI = {
  Components: UIComponents,
  
  // Initialize UI components
  initialize(container) {
    // Use the container or default to document.body
    const targetContainer = container || document.body;
    UIComponents.initializeAll(targetContainer);
    
    // Add system-wide event listeners
    document.addEventListener('sticker:image-selected', (e) => {
      console.log('Image selected:', e.detail);
    });
    
    document.addEventListener('sticker:json-loaded', (e) => {
      console.log('JSON data loaded:', e.detail);
    });
    
    console.log('Unified UI system initialized');
  }
};

// Export to window or module
if (typeof module !== 'undefined') {
  module.exports = UnifiedUI;
} else {
  window.StickerUI = UnifiedUI;
}
