#!/bin/bash

# Canvas Weaver - Full System Startup Script
# This script starts all components of the Canvas Weaver system
# including the Figma plugin server, Chrome extension, and any needed services

echo "🚀 Starting Canvas Weaver System..."

# 1. Kill any existing Node.js processes that might conflict
echo "🧹 Cleaning up existing processes..."
killall node 2>/dev/null || true
echo "✅ Cleanup complete"

# 2. Build the plugin
echo "🔨 Building Figma Plugin..."
npm run build:figma
echo "✅ Figma Plugin built successfully"

# 3. Fix the UI HTML file path
echo "🔧 Ensuring UI HTML is correctly configured..."
if [ -f "build/ui.html" ]; then
  # Fix the script path if needed
  sed -i '' 's|<script src="./build/ui.js"></script>|<script src="./ui.js"></script>|g' build/ui.html
fi

# Make sure manifest.json has the correct UI path
sed -i '' 's/"ui":"build\/ui.js"/"ui":"build\/ui.html"/g' manifest.json

echo "✅ UI configuration fixed"

# 4. Start the server
echo "🌐 Starting Canvas Weaver server..."
npm run start:server &
SERVER_PID=$!

echo "✅ Server started with PID: $SERVER_PID"
echo "   - HTTP API:     http://localhost:3001"
echo "   - WebSocket:    ws://localhost:8082"

echo ""
echo "🎨 Canvas Weaver system is now running!"
echo "   - Your Figma plugin is ready to use"
echo "   - Chrome extension can connect to the server"
echo ""
echo "To stop all services, run: killall node"
