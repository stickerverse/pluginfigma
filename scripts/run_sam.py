#!/usr/bin/env python3
"""
Segment Anything Model (SAM) Script for Canvas Weaver Plugin

This script performs image segmentation using Meta's Segment Anything Model (SAM)
and outputs structured JSON data for use in the Figma plugin workflow.

Dependencies:
- segment-anything
- torch 
- torchvision
- opencv-python
- numpy
- Pillow

Usage:
    python scripts/run_sam.py <image_path>
"""

import sys
import json
import argparse
from pathlib import Path


def check_dependencies():
    """Check if all required dependencies are available."""
    missing_deps = []
    
    try:
        import numpy
    except ImportError:
        missing_deps.append("numpy")
    
    try:
        import torch
    except ImportError:
        missing_deps.append("torch")
    
    try:
        import cv2
    except ImportError:
        missing_deps.append("opencv-python")
    
    try:
        from PIL import Image
    except ImportError:
        missing_deps.append("Pillow")
    
    try:
        from segment_anything import SamAutomaticMaskGenerator, sam_model_registry
    except ImportError:
        missing_deps.append("segment-anything")
    
    if missing_deps:
        raise ImportError(f"Missing dependencies: {', '.join(missing_deps)}")


def load_sam_model(checkpoint_path=None):
    """
    Load the SAM model with checkpoint.
    
    Args:
        checkpoint_path (str): Path to SAM checkpoint file
        
    Returns:
        SamAutomaticMaskGenerator: Configured SAM mask generator
    """
    import torch
    from segment_anything import SamAutomaticMaskGenerator, sam_model_registry
    
    # Default checkpoint paths to try
    default_checkpoints = [
        "sam_vit_h_4b8939.pth",
        "models/sam_vit_h_4b8939.pth",
        "checkpoints/sam_vit_h_4b8939.pth",
        "./sam_vit_h_4b8939.pth"
    ]
    
    if checkpoint_path:
        checkpoint_paths = [checkpoint_path]
    else:
        checkpoint_paths = default_checkpoints
    
    # Try to find a valid checkpoint
    checkpoint_file = None
    for path in checkpoint_paths:
        if Path(path).exists():
            checkpoint_file = path
            break
    
    if not checkpoint_file:
        raise FileNotFoundError(
            f"SAM checkpoint not found. Tried: {checkpoint_paths}. "
            "Please download sam_vit_h_4b8939.pth from Meta's repository."
        )
    
    # Determine device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    # Load model (using vit_h as default - highest quality)
    model_type = "vit_h"
    sam = sam_model_registry[model_type](checkpoint=checkpoint_file)
    sam.to(device=device)
    
    # Create mask generator
    mask_generator = SamAutomaticMaskGenerator(
        model=sam,
        points_per_side=32,
        pred_iou_thresh=0.8,
        stability_score_thresh=0.85,
        crop_n_layers=1,
        crop_n_points_downscale_factor=2,
        min_mask_region_area=100,  # Require connected components to have at least 100 pixels
    )
    
    return mask_generator


def load_image(image_path):
    """
    Load and prepare image for SAM processing.
    
    Args:
        image_path (str): Path to input image
        
    Returns:
        np.ndarray: Image array in RGB format
    """
    import cv2
    
    if not Path(image_path).exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")
    
    # Load image using OpenCV and convert BGR to RGB
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Failed to load image: {image_path}")
    
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    return image_rgb


def process_masks(masks):
    """
    Process SAM masks into structured JSON format.
    
    Args:
        masks (list): List of mask dictionaries from SAM
        
    Returns:
        list: Processed masks with bbox, area, and segmentation data
    """
    import numpy as np
    
    processed_masks = []
    
    for i, mask_data in enumerate(masks):
        # Extract mask and convert to boolean
        mask = mask_data['segmentation'].astype(bool)
        
        # Calculate bounding box
        rows, cols = np.where(mask)
        if len(rows) == 0 or len(cols) == 0:
            continue  # Skip empty masks
            
        bbox = {
            "x": int(np.min(cols)),
            "y": int(np.min(rows)), 
            "width": int(np.max(cols) - np.min(cols) + 1),
            "height": int(np.max(rows) - np.min(rows) + 1)
        }
        
        # Calculate area
        area = int(np.sum(mask))
        
        # Convert mask to polygon coordinates (simplified contour extraction)
        contours = extract_contours(mask)
        
        processed_mask = {
            "id": i,
            "bbox": bbox,
            "area": area,
            "segmentation": contours,
            "stability_score": float(mask_data.get('stability_score', 0.0)),
            "predicted_iou": float(mask_data.get('predicted_iou', 0.0))
        }
        
        processed_masks.append(processed_mask)
    
    return processed_masks


def extract_contours(mask):
    """
    Extract polygon contours from binary mask.
    
    Args:
        mask (np.ndarray): Binary mask array
        
    Returns:
        list: List of polygon coordinates [[x1,y1,x2,y2,...], ...]
    """
    import cv2
    import numpy as np
    
    # Convert boolean mask to uint8
    mask_uint8 = mask.astype(np.uint8) * 255
    
    # Find contours
    contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    polygon_list = []
    for contour in contours:
        # Skip very small contours
        if len(contour) < 3:
            continue
            
        # Flatten contour points to [x1, y1, x2, y2, ...] format
        polygon = contour.reshape(-1, 2).flatten().tolist()
        polygon_list.append(polygon)
    
    return polygon_list


def main():
    parser = argparse.ArgumentParser(description='Run SAM segmentation on an image')
    parser.add_argument('image_path', nargs='?', help='Path to input image')
    parser.add_argument('--checkpoint', help='Path to SAM checkpoint file')
    parser.add_argument('--output', help='Output JSON file (default: stdout)')
    
    # Allow help to be shown even without dependencies
    if len(sys.argv) == 1 or '--help' in sys.argv or '-h' in sys.argv:
        parser.print_help()
        return
    
    args = parser.parse_args()
    
    if not args.image_path:
        parser.print_help()
        sys.exit(1)
    
    try:
        # Check dependencies first
        check_dependencies()
        
        # Load SAM model
        mask_generator = load_sam_model(args.checkpoint)
        
        # Load image
        image = load_image(args.image_path)
        
        # Generate masks
        masks = mask_generator.generate(image)
        
        # Process masks into structured format
        processed_masks = process_masks(masks)
        
        # Create output data
        output_data = {
            "success": True,
            "image_path": args.image_path,
            "image_dimensions": {
                "width": image.shape[1],
                "height": image.shape[0]
            },
            "masks": processed_masks,
            "total_masks": len(processed_masks)
        }
        
        # Output JSON
        json_output = json.dumps(output_data, indent=2)
        
        if args.output:
            with open(args.output, 'w') as f:
                f.write(json_output)
        else:
            print(json_output)
            
    except ImportError as e:
        error_output = {
            "success": False,
            "error": str(e),
            "message": "Please install dependencies: pip install -r scripts/requirements.txt"
        }
        print(json.dumps(error_output, indent=2), file=sys.stderr)
        sys.exit(1)
        
    except Exception as e:
        error_output = {
            "success": False,
            "error": str(e),
            "image_path": args.image_path if 'args' in locals() else None
        }
        
        if 'args' in locals() and args.output:
            with open(args.output, 'w') as f:
                json.dump(error_output, f, indent=2)
        else:
            print(json.dumps(error_output, indent=2), file=sys.stderr)
        
        sys.exit(1)


if __name__ == "__main__":
    main()