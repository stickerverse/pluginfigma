#!/bin/bash
# Download SAM checkpoint file for production use

set -e

echo "🔄 Downloading SAM checkpoint file..."

# Create models directory if it doesn't exist
mkdir -p models

# Check if checkpoint already exists
if [ -f "models/sam_vit_h_4b8939.pth" ]; then
    echo "✅ SAM checkpoint already exists at models/sam_vit_h_4b8939.pth"
    exit 0
fi

# Download the checkpoint file
echo "📥 Downloading ViT-H SAM model (2.56GB)..."
curl -L "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth" \
     -o "models/sam_vit_h_4b8939.pth" \
     --progress-bar

# Verify download
if [ -f "models/sam_vit_h_4b8939.pth" ]; then
    echo "✅ SAM checkpoint downloaded successfully!"
    echo "📁 Location: models/sam_vit_h_4b8939.pth"
    echo "📊 Size: $(du -h models/sam_vit_h_4b8939.pth | cut -f1)"
else
    echo "❌ Failed to download SAM checkpoint"
    exit 1
fi