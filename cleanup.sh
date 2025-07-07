#!/bin/bash

# Canvas Weaver - Project Directory Cleanup Script
# This script removes unnecessary backup files, test files, and temporary files

echo "🧹 Canvas Weaver Project Cleanup"
echo "==============================="

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
  else
    echo "⚠️ File not found: $1"
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

echo -e "\n🔍 Removing duplicate/standalone files..."
# Standalone files (if you're not using standalone mode)
read -p "Remove standalone-manifest.json? (y/n) " remove_standalone
if [ "$remove_standalone" == "y" ]; then
  backup_file "/Users/skirk92/Desktop/pluginfigma-main/standalone-manifest.json"
  backup_file "/Users/skirk92/Desktop/pluginfigma-main/standalone-code.js"
  backup_file "/Users/skirk92/Desktop/pluginfigma-main/standalone-ui.html"
  backup_file "/Users/skirk92/Desktop/pluginfigma-main/STANDALONE-README.md"
fi

# Simple code version
read -p "Remove simple-code.js? (y/n) " remove_simple
if [ "$remove_simple" == "y" ]; then
  backup_file "/Users/skirk92/Desktop/pluginfigma-main/simple-code.js"
fi

echo -e "\n🔍 Removing fix scripts..."
# Automated fix scripts (now that issues are resolved)
read -p "Remove fix scripts? (y/n) " remove_fix
if [ "$remove_fix" == "y" ]; then
  backup_file "/Users/skirk92/Desktop/pluginfigma-main/fix-plugin.sh"
  backup_file "/Users/skirk92/Desktop/pluginfigma-main/fix-typescript-build.sh"
  backup_file "/Users/skirk92/Desktop/pluginfigma-main/check-plugin.sh"
fi

echo -e "\n🧹 Project cleanup complete!"
echo "Files have been backed up to: $BACKUP_DIR"
echo "You can safely delete this backup directory if everything works correctly."
