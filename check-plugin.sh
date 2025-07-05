#!/bin/bash

# Plugin Health Check Script
echo "🔍 Figma Plugin Health Check"
echo "============================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not found. Run 'npm install' first."
    exit 1
fi

# Check if build directory exists
if [ ! -d "build" ]; then
    echo "❌ build directory not found. Run 'npm run build' first."
    exit 1
fi

# Check if main files exist
if [ ! -f "build/main.js" ]; then
    echo "❌ build/main.js not found"
    exit 1
fi

if [ ! -f "build/ui.js" ]; then
    echo "❌ build/ui.js not found"
    exit 1
fi

echo "✅ Core build files exist"

# Check if shared files exist
if [ ! -f "build/shared/core.js" ]; then
    echo "⚠️  build/shared/core.js not found - running copy-shared"
    npm run copy-shared
fi

if [ ! -f "build/shared/unified-ui.js" ]; then
    echo "⚠️  build/shared/unified-ui.js not found - running copy-shared" 
    npm run copy-shared
fi

echo "✅ Shared files available"

# Check manifest.json
if [ ! -f "manifest.json" ]; then
    echo "❌ manifest.json not found"
    exit 1
fi

echo "✅ manifest.json exists"

# Check JavaScript syntax
node -c build/main.js && echo "✅ main.js syntax valid" || (echo "❌ main.js syntax error" && exit 1)
node -c build/ui.js && echo "✅ ui.js syntax valid" || (echo "❌ ui.js syntax error" && exit 1)

# Check JSON validity
python -m json.tool manifest.json > /dev/null && echo "✅ manifest.json valid" || (echo "❌ manifest.json invalid" && exit 1)

echo ""
echo "🎉 Plugin health check passed!"
echo ""
echo "To test in Figma:"
echo "1. Open Figma Desktop"
echo "2. Go to Plugins > Development > Import plugin from manifest..."
echo "3. Select the manifest.json file from this directory"
echo "4. Run the plugin to test functionality"