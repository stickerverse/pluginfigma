# Image-to-Figma Component Converter

A complete toolkit that converts UI design images into fully editable Figma components using Google Cloud Vision API. This project includes both a Figma plugin and a Chrome extension for testing image analysis functionality.

## Overview

The Image-to-Figma Component Converter transforms static UI mockup images into living, fully-functional Figma design files. Unlike simple image imports, this tool creates native Figma layers that designers can immediately customize and adapt.

## Project Components

This repository contains two main components:

1. **Figma Plugin**: The core tool for converting images to editable Figma components
2. **Chrome Extension**: A testing utility for analyzing UI images directly in your browser

## Figma Plugin

### Features

- Convert UI screenshots and mockups into editable Figma components
- Extract color palettes and create Figma color styles
- Detect and recreate text elements with proper fonts and styling
- Identify UI components like buttons, input fields, cards, and more
- Generate proper component hierarchy and structure

### Development Setup

1. Clone this repository
2. Update your Google Cloud Vision API key in `src/config.ts`
3. Open Figma desktop app
4. Go to Plugins > Development > Import plugin from manifest
5. Select the `manifest.json` file from this repository
6. The plugin will appear in your development plugins list

### How It Works

1. User uploads or selects an image of a UI design
2. The plugin sends the image to Google Cloud Vision API
3. AI analysis identifies components, colors, text, and layouts
4. The plugin processes the analysis results to create native Figma elements
5. All elements are generated as fully editable Figma nodes (frames, rectangles, text) with proper styling

## Chrome Extension

### Features

- Analyze UI images directly in your browser
- Extract color palettes, typography, and component information
- Test image analysis functionality without Figma
- Works with both webpage images and uploaded files

### Installation

1. Navigate to the `chrome-extension` directory
2. Update your API key in `config.js`
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable Developer Mode (toggle in top right)
5. Click "Load unpacked" and select the `chrome-extension` folder
6. Open the included `test.html` file to test with sample images

For detailed instructions, see `chrome-extension/install_guide.html`

### Testing Workflow

1. Click the extension icon in Chrome
2. Choose "Analyze Images on Page" or "Upload an Image"
3. View analysis results showing detected components, colors, and text
4. Use these insights to improve the Figma plugin implementation

## Technical Details

### Technologies Used

- **TypeScript**: For type-safe development of both Figma plugin and Chrome extension
- **Google Cloud Vision API**: For image analysis and component detection
- **Figma Plugin API**: For creating and manipulating Figma nodes
- **Chrome Extension API**: For browser integration and image processing

### Core Components

#### Figma Plugin
- `main.ts`: Entry point and main plugin logic
- `ui.tsx`: User interface for image upload and status display
- `config.ts`: Configuration and API key storage

#### Chrome Extension
- `popup.js`: Main extension functionality and UI interaction
- `content.js`: In-page image detection
- `background.js`: Background service worker

### Security Considerations

- API keys should be kept secure and not committed to public repositories
- Consider implementing server-side proxy for production deployments
- Use environment variables for sensitive information

## Contribution Guidelines

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Future Plans

- Enhance component detection accuracy
- Implement auto-layout detection and recreation
- Add support for responsive design principles
- Create component variants based on detected states
- Improve text styling fidelity
- Build a web service version for non-Figma designers

## Supported Node Types

- FRAME
- RECTANGLE
- TEXT
- COMPONENT
- GROUP

## Future Enhancements

- Support for more node types (ellipse, vector, etc.)
- Direct clipboard integration
- Style extraction and application
- Import from design tokens

## License

MIT
