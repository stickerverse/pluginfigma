#!/bin/bash

# Canvas Weaver System Configuration Checker
# This script checks the configuration of all Canvas Weaver components
# and reports any issues or inconsistencies

echo "🔍 Canvas Weaver System Configuration Checker"
echo "============================================="

# Check if servers are running
echo -e "\n📡 Checking server status..."
HTTP_PORT=3001
WS_PORT=8082

HTTP_RUNNING=$(lsof -i :$HTTP_PORT | grep LISTEN)
WS_RUNNING=$(lsof -i :$WS_PORT | grep LISTEN)

if [ -n "$HTTP_RUNNING" ]; then
  echo "✅ HTTP API server is running on port $HTTP_PORT"
else
  echo "❌ HTTP API server is NOT running on port $HTTP_PORT"
fi

if [ -n "$WS_RUNNING" ]; then
  echo "✅ WebSocket server is running on port $WS_PORT"
else
  echo "❌ WebSocket server is NOT running on port $WS_PORT"
fi

# Check manifest.json configuration
echo -e "\n📝 Checking Figma plugin manifest..."
if grep -q '"ui":"build/ui.html"' manifest.json; then
  echo "✅ Manifest points to correct UI HTML file"
else
  echo "❌ Manifest does not point to UI HTML file (should be 'build/ui.html')"
fi

# Check UI HTML file
echo -e "\n🖥️ Checking UI HTML configuration..."
if [ -f "build/ui.html" ]; then
  echo "✅ UI HTML file exists"
  if grep -q '<script src="./ui.js"></script>' build/ui.html; then
    echo "✅ UI HTML file correctly references UI JavaScript"
  else
    echo "❌ UI HTML file has incorrect JavaScript reference"
  fi
else
  echo "❌ UI HTML file does not exist at build/ui.html"
fi

# Check Chrome extension configuration
echo -e "\n🌐 Checking Chrome extension configuration..."
if grep -q "ws://localhost:8082" chrome-extension/background.js; then
  echo "✅ Chrome extension background script uses correct WebSocket URL"
else
  echo "❌ Chrome extension background script has incorrect WebSocket URL (should be 'ws://localhost:8082')"
fi

# Check server configuration
echo -e "\n⚙️ Checking server configuration..."
if grep -q "websocketPort: process.env.WS_PORT || 8082" server/production-config.js; then
  echo "✅ Server configured to use WebSocket port 8082"
else
  echo "❌ Server configuration has incorrect WebSocket port (should be 8082)"
fi

if grep -q "new WebSocketBroker(8082)" server/server.js; then
  echo "✅ Server initialization uses correct WebSocket port"
else
  echo "❌ Server initialization uses incorrect WebSocket port (should be 8082)"
fi

# Check plugin WebSocket configuration
echo -e "\n🔌 Checking plugin WebSocket configuration..."
if grep -q "websocketUrl: isDev ? 'ws://localhost:8082'" src/production-config.ts; then
  echo "✅ Plugin configured to use correct WebSocket URL"
else
  echo "❌ Plugin configuration has incorrect WebSocket URL (should use port 8082)"
fi

echo -e "\n✨ Configuration check complete!"
