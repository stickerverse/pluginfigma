# SAM (Segment Anything Model) Integration

This directory contains the Python script for integrating Meta's Segment Anything Model (SAM) with the Canvas Weaver Figma plugin.

## Setup

1. **Install Python Dependencies:**
   ```bash
   pip install -r scripts/requirements.txt
   ```

2. **Download SAM Checkpoint:**
   Download the SAM model checkpoint from Meta's repository:
   ```bash
   # Download the ViT-H SAM model (recommended for best quality)
   wget https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth
   ```
   
   Place the checkpoint file in one of these locations:
   - `sam_vit_h_4b8939.pth` (root directory)
   - `models/sam_vit_h_4b8939.pth`
   - `checkpoints/sam_vit_h_4b8939.pth`

## Usage

### Basic Usage
```bash
python scripts/run_sam.py path/to/image.jpg
```

### With Custom Checkpoint
```bash
python scripts/run_sam.py path/to/image.jpg --checkpoint /path/to/sam_checkpoint.pth
```

### Save to File
```bash
python scripts/run_sam.py path/to/image.jpg --output output.json
```

## Output Format

The script outputs JSON with the following structure:

```json
{
  "success": true,
  "image_path": "path/to/image.jpg",
  "image_dimensions": {
    "width": 1920,
    "height": 1080
  },
  "masks": [
    {
      "id": 0,
      "bbox": {
        "x": 100,
        "y": 50,
        "width": 200,
        "height": 150
      },
      "area": 25000,
      "segmentation": [[x1, y1, x2, y2, ...]],
      "stability_score": 0.95,
      "predicted_iou": 0.88
    }
  ],
  "total_masks": 42
}
```

## Integration with Node.js

The script is designed to be called from Node.js using child_process:

```javascript
const { spawn } = require('child_process');

function runSAM(imagePath) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', ['scripts/run_sam.py', imagePath]);
    
    let output = '';
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          reject(new Error('Failed to parse SAM output'));
        }
      } else {
        reject(new Error(`SAM script failed with code ${code}`));
      }
    });
  });
}
```

## Error Handling

The script provides structured error output in JSON format:

```json
{
  "success": false,
  "error": "Error description",
  "image_path": "path/to/image.jpg"
}
```

## Performance Notes

- GPU acceleration is automatically used if CUDA is available
- For better performance on CPU, consider using the smaller ViT-B model
- The script includes optimized parameters for UI element segmentation
- Minimum mask area is set to 100 pixels to filter out noise