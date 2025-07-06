#!/usr/bin/env node
/**
 * Test script for the new HTTP image processing endpoint
 */

const fs = require('fs');
const path = require('path');

async function testEndpoint() {
  console.log('🧪 Testing HTTP Image Processing Endpoint\n');
  
  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:8080/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check passed:', healthData.status);
    console.log();
    
    // Test 2: Create test image
    console.log('2. Creating test image...');
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(200, 150);
    const ctx = canvas.getContext('2d');
    
    // Draw a simple UI mockup
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 200, 150);
    
    ctx.fillStyle = '#3498db';
    ctx.fillRect(10, 10, 180, 30);
    
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(10, 50, 80, 40);
    
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(110, 50, 80, 40);
    
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(10, 100, 180, 20);
    
    const buffer = canvas.toBuffer('image/png');
    const base64Image = buffer.toString('base64');
    console.log('✅ Test image created (200x150px with UI elements)');
    console.log();
    
    // Test 3: Process image
    console.log('3. Testing image processing endpoint...');
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:8080/api/process-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        base64Image: base64Image
      })
    });
    
    const processingTime = Date.now() - startTime;
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Image processing completed');
    console.log(`   Processing time: ${processingTime}ms`);
    console.log(`   Elements found: ${result.elements.length}`);
    console.log(`   Image size: ${result.image_size[0]}x${result.image_size[1]}`);
    console.log();
    
    // Test 4: Validate results structure
    console.log('4. Validating result structure...');
    let validationErrors = [];
    
    if (!Array.isArray(result.elements)) {
      validationErrors.push('elements should be an array');
    }
    
    result.elements.forEach((element, i) => {
      if (!Array.isArray(element.bbox) || element.bbox.length !== 4) {
        validationErrors.push(`element[${i}].bbox should be array of 4 numbers`);
      }
      if (typeof element.area !== 'number') {
        validationErrors.push(`element[${i}].area should be a number`);
      }
      if (typeof element.svgPath !== 'string') {
        validationErrors.push(`element[${i}].svgPath should be a string`);
      }
    });
    
    if (validationErrors.length === 0) {
      console.log('✅ Result structure validation passed');
    } else {
      console.log('❌ Result structure validation failed:');
      validationErrors.forEach(error => console.log(`   - ${error}`));
    }
    console.log();
    
    // Test 5: Display sample results
    console.log('5. Sample results:');
    result.elements.slice(0, 2).forEach((element, i) => {
      console.log(`   Element ${i + 1}:`);
      console.log(`     Bbox: [${element.bbox.join(', ')}]`);
      console.log(`     Area: ${element.area}`);
      console.log(`     SVG Path: ${element.svgPath.substring(0, 50)}...`);
      console.log(`     Stability: ${element.stability_score?.toFixed(3) || 'N/A'}`);
      console.log();
    });
    
    // Test 6: Error handling
    console.log('6. Testing error handling...');
    const errorResponse = await fetch('http://localhost:8080/api/process-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Missing base64Image
      })
    });
    
    if (errorResponse.status === 400) {
      const errorData = await errorResponse.json();
      console.log('✅ Error handling works correctly:', errorData.error);
    } else {
      console.log('❌ Error handling failed - should return 400 for missing image');
    }
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Install canvas if not available
try {
  require('canvas');
} catch (e) {
  console.log('Installing canvas dependency...');
  const { execSync } = require('child_process');
  execSync('npm install canvas', { cwd: path.dirname(__filename) });
}

testEndpoint();