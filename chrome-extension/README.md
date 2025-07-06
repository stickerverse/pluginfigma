# Image Analyzer Chrome Extension

This Chrome extension allows you to analyze images on web pages using Google Cloud Vision API and extract UI components, colors, and typography information.

## Setup Instructions

1. **Add your API keys**
   - Open `config.js` and replace the placeholder values with your actual API keys:
     ```javascript
     export const VISION_API_KEY = "YOUR_GOOGLE_VISION_API_KEY";
     export const FIGMA_API_KEY = "YOUR_FIGMA_API_KEY";
     ```

2. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" using the toggle in the top right
   - Click "Load unpacked" and select the `chrome-extension` folder

3. **Add proper icons**
   - Replace the placeholder icon files in the `icons` directory with actual icon images of the corresponding sizes (16x16, 48x48, and 128x128 pixels)

## Usage

1. Click on the extension icon in your browser toolbar
2. Choose one of the options:
   - **Analyze Images on Page**: Scans the current page for images and lets you select one to analyze
   - **Upload an Image**: Upload an image from your computer to analyze

3. View the analysis results showing:
   - Detected UI components
   - Color palette
   - Text elements

## Features

- Detects UI components like buttons, text fields, and more
- Extracts color palette information
- Identifies text elements and their properties
- Works with both web images and uploaded images

## Notes

This extension is for testing purposes and demonstrates the core functionality of the Image-to-Figma Component Converter.
