#!/bin/bash

# Build the plugin
npm run build

# Ensure the ui.html file is in the build directory
if [ ! -f "build/ui.html" ]; then
  cat > build/ui.html << EOL
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Canvas Weaver</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--figma-color-text);
      background-color: var(--figma-color-bg);
    }
    #create-figma-plugin {
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="create-figma-plugin"></div>
  <script src="./ui.js"></script>
</body>
</html>
EOL
fi

# Make sure manifest.json points to ui.html, not ui.js
sed -i '' 's/"ui":"build\/ui.js"/"ui":"build\/ui.html"/g' manifest.json

echo "✅ Plugin build complete and ready for Figma"
