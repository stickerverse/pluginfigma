# Minimal Figma Plugin

This directory contains three files that form a minimal working Figma plugin that works without any build process:

## Files

1. **`standalone-manifest.json`** - Plugin manifest file that defines the plugin configuration
2. **`standalone-code.js`** - Main plugin code that runs in Figma's plugin sandbox
3. **`standalone-ui.html`** - HTML UI that provides the user interface

## Features

This minimal plugin demonstrates:
- ✅ Basic plugin structure and communication
- ✅ UI that shows buttons and status messages  
- ✅ Creating a rectangle when button is clicked
- ✅ Message passing between UI and plugin code
- ✅ User feedback via notifications
- ✅ Plugin lifecycle management (close plugin)

## How to Use

1. Open Figma Desktop
2. Go to **Plugins** > **Development** > **Import plugin from manifest...**
3. Select the `standalone-manifest.json` file
4. The plugin will appear in your plugins list as "Minimal Figma Plugin"
5. Run the plugin and click "Create Rectangle" to test functionality

## Communication Flow

1. UI loads and displays interface
2. User clicks "Create Rectangle" button
3. UI sends `create-rectangle` message to plugin code
4. Plugin code creates a blue rectangle at position (100, 100)
5. Plugin code sends confirmation back to UI
6. UI displays success message

## No Build Process Required

These files work directly in Figma without any compilation, TypeScript, or build tools. They use vanilla JavaScript and HTML, making them perfect for:
- Learning Figma plugin development
- Quick prototyping
- Understanding plugin communication patterns
- Base template for simple plugins

## Testing

Run the included test to verify all files are properly structured:

```bash
node test-standalone-plugin.js
```