#!/usr/bin/env python3
"""
SAM (Segment Anything Model) inference script for Canvas Weaver
Processes an input image and returns segmentation masks as JSON
"""

import sys
import json
import os
from PIL import Image
import numpy as np

def create_mock_sam_masks(image_path):
    """
    Mock SAM implementation that generates sample segmentation masks
    In production, this would use the actual SAM model
    """
    try:
        # Load image to get dimensions
        with Image.open(image_path) as img:
            width, height = img.size
        
        # Generate more realistic mock segmentation masks based on image size
        masks = []
        
        # Create 2-4 masks depending on image size
        num_masks = min(4, max(2, width // 100))
        
        for i in range(num_masks):
            # Generate reasonable bounding boxes within image bounds
            max_w = min(width * 0.4, 200)  # Max 40% of image width or 200px
            max_h = min(height * 0.4, 150)  # Max 40% of image height or 150px
            
            w = int(max_w * (0.5 + 0.5 * (i + 1) / num_masks))  # Varying sizes
            h = int(max_h * (0.5 + 0.5 * (i + 1) / num_masks))
            
            # Position within image bounds with some padding
            padding = 20
            x = padding + int((width - w - 2 * padding) * i / max(1, num_masks - 1))
            y = padding + int((height - h - 2 * padding) * i / max(1, num_masks - 1))
            
            # Ensure bounds are within image
            x = max(0, min(x, width - w))
            y = max(0, min(y, height - h))
            
            # Create segmentation as a simple rectangle (in production would be complex polygon)
            segmentation = [
                x, y,           # top-left
                x + w, y,       # top-right  
                x + w, y + h,   # bottom-right
                x, y + h        # bottom-left
            ]
            
            masks.append({
                "bbox": [x, y, w, h],  # x, y, width, height
                "area": w * h,
                "segmentation": [segmentation],
                "stability_score": 0.85 + 0.1 * np.random.random(),
                "predicted_iou": 0.80 + 0.15 * np.random.random()
            })
        
        return {
            "image_path": image_path,
            "image_size": [width, height],
            "masks": masks,
            "processing_time": 0.1 + 0.1 * np.random.random(),
            "model_version": "sam_mock_v1.0"
        }
        
    except Exception as e:
        return {
            "error": f"Failed to process image: {str(e)}",
            "image_path": image_path
        }

def main():
    if len(sys.argv) != 2:
        print(json.dumps({
            "error": "Usage: python run_sam.py <image_path>",
            "args_received": sys.argv
        }))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(json.dumps({
            "error": f"Image file not found: {image_path}"
        }))
        sys.exit(1)
    
    # Process image with SAM (mock implementation)
    result = create_mock_sam_masks(image_path)
    
    # Output JSON result
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()