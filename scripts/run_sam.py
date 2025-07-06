"""
Segment Anything Model (SAM) inference script for Canvas Weaver Plugin

Processes an input image and returns segmentation masks as structured JSON output.

Usage:
  python3 scripts/run_sam.py path/to/image.jpg
  python3 scripts/run_sam.py image.jpg --checkpoint /path/to/sam_checkpoint.pth
  python3 scripts/run_sam.py image.jpg --output results.json
"""

import sys
import json
import os
import argparse
from pathlib import Path
import numpy as np

def check_dependencies():
    """Check if all required dependencies are available."""
    missing_deps = []
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

def load_image(image_path):
    """Load image from given path and convert to RGB numpy array."""
    import cv2
    if not Path(image_path).exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")
    image_bgr = cv2.imread(image_path)
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    return image_rgb

def run_sam_inference(image_rgb, checkpoint=None):
    import torch
    from segment_anything import SamAutomaticMaskGenerator, sam_model_registry

    device = "cuda" if torch.cuda.is_available() else "cpu"
    default_checkpoints = [
        "sam_vit_h_4b8939.pth",
        "/models/sam_vit_h_4b8939.pth",
        checkpoint
    ] if checkpoint else ["sam_vit_h_4b8939.pth"]

    checkpoint_file = next((p for p in default_checkpoints if Path(p).exists()), None)
    if not checkpoint_file:
        raise FileNotFoundError("SAM checkpoint not found.")

    model_type = "vit_h"
    sam = sam_model_registry[model_type](checkpoint=checkpoint_file)
    sam.to(device='cuda' if torch.cuda.is_available() else 'cpu')

    mask_generator = SamAutomaticMaskGenerator(sam)
    masks = mask_generator.generate(image_rgb)
    return masks

def process_masks(masks):
    processed_masks = []
    for i, mask_data in enumerate(masks):
        mask = mask_data['segmentation']
        bbox = mask_data['bbox']
        area = mask_data['area']
        stability_score = mask_data.get('stability_score', 0.0)
        predicted_iou = mask_data.get('predicted_iou', 0.0)

        segmentation_polygons = extract_polygons_from_mask(mask)

        processed_mask = {
            "id": i,
            "bbox": {
                "x": int(bbox[0]),
                "y": int(bbox[1]),
                "width": int(bbox[2]),
                "height": int(bbox[3])
            },
            "area": area,
            "segmentation": segmentation,
            "stability_score": stability_score,
            "predicted_iou": predicted_iou
        }
        processed_masks.append(processed_mask)
    return processed_masks

def extract_polygons(mask):
    import cv2
    mask_uint8 = mask.astype(np.uint8) * 255
    contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    polygons = [contour.reshape(-1, 2).flatten().tolist() for contour in contours]
    return polygons

def main():
    parser = argparse.ArgumentParser(description='Run Segment Anything Model (SAM) segmentation')
    parser.add_argument('image_path', help='Path to input image')
    parser.add_argument('--checkpoint', help='Custom SAM checkpoint path', default=None)
    parser.add_argument('--output', help='Output JSON file path', default=None)
    args = parser.parse_args()

    try:
        check_dependencies()
        image_rgb = load_image(args.image_path)
        masks = run_sam_inference(image_rgb=image_rgb, checkpoint=args.checkpoint)
        output_data = {
            "success": True,
            "image_path": args.image_path,
            "image_dimensions": {"width": image_rgb.shape[1], "height": image_rgb.shape[0]},
            "masks": masks,
            "total_masks": len(masks)
        }
        output_json = json.dumps(output_data, indent=2)
        print(output_json)

    except Exception as e:
        error_output = {
            "success": False,
            "error": str(e),
            "message": "Please verify dependencies and checkpoint files."
        }
        print(json.dumps(error_output, indent=2), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
