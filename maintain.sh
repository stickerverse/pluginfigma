#!/bin/bash

# Canvas Weaver - Project Maintenance Script
# This script performs regular maintenance tasks to keep the project clean

echo "🔧 Canvas Weaver Project Maintenance"
echo "=================================="

# Function to ensure a directory exists
ensure_dir() {
  if [ ! -d "$1" ]; then
    mkdir -p "$1"
    echo "📁 Created directory: $1"
  fi
}

# Function to check for and remove common temporary files
clean_temp_files() {
  echo -e "\n🔍 Cleaning temporary files..."
  find "$1" -name "*.tmp" -o -name "*.bak" -o -name "*.old" | grep -v "node_modules" | while read file; do
    rm "$file"
    echo "🗑️  Removed temporary file: ${file#$1/}"
  done
}

# Clean build artifacts
clean_build() {
  if [ -d "$1/build" ]; then
    read -p "Clean build directory? This will require rebuilding the project. (y/n) " clean_build_dir
    if [ "$clean_build_dir" == "y" ]; then
      rm -rf "$1/build"
      echo "🧹 Removed build directory"
      npm run build
      echo "🔨 Rebuilt project"
    fi
  fi
}

# Ensure critical directories exist
ensure_dir "/Users/skirk92/Desktop/pluginfigma-main/build"

# Clean temporary files
clean_temp_files "/Users/skirk92/Desktop/pluginfigma-main"

# Ensure the UI HTML file is in the build directory
if [ ! -f "/Users/skirk92/Desktop/pluginfigma-main/build/ui.html" ]; then
  echo -e "\n🔧 Creating missing UI HTML file..."
  cat > "/Users/skirk92/Desktop/pluginfigma-main/build/ui.html" << EOL
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
  echo "✅ Created UI HTML file"
fi

# Make sure manifest.json has the correct UI path
if grep -q '"ui":"build/ui.js"' "/Users/skirk92/Desktop/pluginfigma-main/manifest.json"; then
  echo -e "\n🔧 Fixing manifest.json..."
  sed -i '' 's/"ui":"build\/ui.js"/"ui":"build\/ui.html"/g' "/Users/skirk92/Desktop/pluginfigma-main/manifest.json"
  echo "✅ Updated manifest.json to point to UI HTML file"
fi

# Optional: Clean build directory
clean_build "/Users/skirk92/Desktop/pluginfigma-main"

echo -e "\n✨ Project maintenance complete!"
