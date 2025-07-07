#!/bin/bash

# Canvas Weaver - Automated Project Directory Cleanup Script
# This script removes unnecessary backup files, test files, and temporary files without confirmation

echo "🧹 Canvas Weaver Automated Project Cleanup"
echo "========================================"

# Create a backup directory for files we're removing (just in case)
BACKUP_DIR="/Users/skirk92/Desktop/pluginfigma-cleanup-backup-$(date +%Y%m%d%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "📦 Created backup directory: $BACKUP_DIR"

# Function to safely move files to backup
backup_file() {
  if [ -e "$1" ]; then
    relative_path=${1#/Users/skirk92/Desktop/pluginfigma-main/}
    backup_path="$BACKUP_DIR/$relative_path"
    mkdir -p "$(dirname "$backup_path")"
    cp -r "$1" "$backup_path"
    rm -rf "$1"
    echo "✅ Removed: $relative_path"
  fi
}

echo -e "\n🔍 Removing backup and old files..."
# Backup files
backup_file "/Users/skirk92/Desktop/pluginfigma-main/src.backup"
backup_file "/Users/skirk92/Desktop/pluginfigma-main/code.js.old"
backup_file "/Users/skirk92/Desktop/pluginfigma-main/src/ui.tsx.bak"
backup_file "/Users/skirk92/Desktop/pluginfigma-main/server/server.old.js"

echo -e "\n🔍 Removing test files..."
# Test files (outside of the test directory)
backup_file "/Users/skirk92/Desktop/pluginfigma-main/test-plugin.js"
backup_file "/Users/skirk92/Desktop/pluginfigma-main/test-http-endpoint.js"
backup_file "/Users/skirk92/Desktop/pluginfigma-main/test-websocket.js"
backup_file "/Users/skirk92/Desktop/pluginfigma-main/test-component-data.json"

# Remove build artifacts
echo -e "\n🔍 Cleaning node_modules and build directories..."
# This part is commented out by default since it's more aggressive
# Uncomment if you want to remove build directories
# rm -rf /Users/skirk92/Desktop/pluginfigma-main/node_modules
# rm -rf /Users/skirk92/Desktop/pluginfigma-main/server/node_modules
# rm -rf /Users/skirk92/Desktop/pluginfigma-main/build

echo -e "\n🧹 Project cleanup complete!"
echo "Files have been backed up to: $BACKUP_DIR"
echo "You can safely delete this backup directory if everything works correctly."
