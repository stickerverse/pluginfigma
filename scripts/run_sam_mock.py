"""
Mock SAM script for testing without actual SAM dependencies
Generates realistic-looking segmentation data for testing the pipeline
"""

import sys
import json
import os
import argparse
from pathlib import Path
import numpy as np

def check_dependencies():
    """Check if basic dependencies are available."""
    missing_deps = []
    try:
        import numpy as np
    except ImportError:
        missing_deps.append("numpy")
    try:
        from PIL import Image
    except ImportError:
        missing_deps.append("Pillow")
    
    if missing_deps:
        raise ImportError(f"Missing dependencies: {', '.join(missing_deps)}")

def load_image(image_path):
    """Load image from given path and convert to RGB numpy array."""
    from PIL import Image
    if not Path(image_path).exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")
    
    image = Image.open(image_path)
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    return np.array(image)

def generate_mock_masks(image_rgb):
    """Generate mock segmentation masks for testing."""
    height, width = image_rgb.shape[:2]
    
    # Generate 3-5 realistic UI element masks
    masks = []
    num_masks = np.random.randint(3, 6)
    
    for i in range(num_masks):
        # Generate realistic bounding box
        x = np.random.randint(0, width - 50)
        y = np.random.randint(0, height - 30)
        w = np.random.randint(30, min(width - x, 120))
        h = np.random.randint(20, min(height - y, 80))
        
        # Generate polygon points around the bounding box with some variation
        margin = 5
        points = [
            x + margin, y + margin,
            x + w - margin, y + margin,
            x + w - margin, y + h - margin,
            x + margin, y + h - margin
        ]
        
        # Add some randomness to make it more realistic
        for j in range(len(points)):
            if j % 2 == 0:  # x coordinates
                points[j] += np.random.randint(-2, 3)
            else:  # y coordinates
                points[j] += np.random.randint(-2, 3)
        
        mask = {
            'segmentation': np.zeros((height, width), dtype=bool),
            'bbox': [x, y, w, h],
            'area': w * h,
            'stability_score': np.random.uniform(0.85, 0.99),
            'predicted_iou': np.random.uniform(0.80, 0.95)
        }
        
        # Fill the mask area
        mask['segmentation'][y:y+h, x:x+w] = True
        
        masks.append(mask)
    
    return masks

def process_masks(masks):
    """Process masks into the expected format."""
    processed_masks = []
    for i, mask_data in enumerate(masks):
        mask = mask_data['segmentation']
        bbox = mask_data['bbox']
        area = mask_data['area']
        stability_score = mask_data.get('stability_score', 0.0)
        predicted_iou = mask_data.get('predicted_iou', 0.0)

        # Extract contours to create polygon segmentation
        segmentation_polygons = extract_polygons(mask)

        processed_mask = {
            "id": i,
            "bbox": {
                "x": int(bbox[0]),
                "y": int(bbox[1]),
                "width": int(bbox[2]),
                "height": int(bbox[3])
            },
            "area": int(area),
            "segmentation": segmentation_polygons,
            "stability_score": float(stability_score),
            "predicted_iou": float(predicted_iou)
        }
        processed_masks.append(processed_mask)
    return processed_masks

def extract_polygons(mask):
    """Extract polygon contours from binary mask."""
    try:
        import cv2
        mask_uint8 = mask.astype(np.uint8) * 255
        contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        polygons = [contour.reshape(-1, 2).flatten().tolist() for contour in contours]
        return polygons
    except ImportError:
        # Fallback if opencv not available - create simple rectangle polygon
        h, w = mask.shape
        y_indices, x_indices = np.where(mask)
        if len(x_indices) == 0:
            return [[0, 0, 10, 0, 10, 10, 0, 10]]  # Default small square
        
        min_x, max_x = int(np.min(x_indices)), int(np.max(x_indices))
        min_y, max_y = int(np.min(y_indices)), int(np.max(y_indices))
        
        return [[min_x, min_y, max_x, min_y, max_x, max_y, min_x, max_y]]

def main():
    parser = argparse.ArgumentParser(description='Mock SAM segmentation for testing')
    parser.add_argument('image_path', help='Path to input image')
    parser.add_argument('--checkpoint', help='Ignored in mock version', default=None)
    parser.add_argument('--output', help='Output JSON file path', default=None)
    args = parser.parse_args()

    try:
        check_dependencies()
        image_rgb = load_image(args.image_path)
        masks = generate_mock_masks(image_rgb)
        processed_masks = process_masks(masks)
        
        output_data = {
            "success": True,
            "image_path": args.image_path,
            "image_dimensions": {"width": image_rgb.shape[1], "height": image_rgb.shape[0]},
            "masks": processed_masks,
            "total_masks": len(processed_masks),
            "model_version": "mock_sam_v1.0"
        }
        
        output_json = json.dumps(output_data, indent=2)
        
        if args.output:
            with open(args.output, 'w') as f:
                f.write(output_json)
        else:
            print(output_json)

    except Exception as e:
        error_output = {
            "success": False,
            "error": str(e),
            "message": "Mock SAM processing failed."
        }
        print(json.dumps(error_output, indent=2), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()