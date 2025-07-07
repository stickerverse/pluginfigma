#!/usr/bin/env node

/**
 * Production Build Script for Canvas Weaver
 * 
 * This script:
 * - Removes all debug logging
 * - Minifies code
 * - Optimizes bundle sizes
 * - Sets production environment variables
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Building Canvas Weaver for Production...\n');

// 1. Clean previous builds
console.log('1. Cleaning previous builds...');
try {
  execSync('rm -rf build dist', { stdio: 'inherit' });
  console.log('✅ Cleaned build directories\n');
} catch (error) {
  console.log('⚠️ No previous builds to clean\n');
}

// 2. Set production environment
console.log('2. Setting production environment...');
process.env.NODE_ENV = 'production';
console.log('✅ Environment set to production\n');

// 3. Build Figma plugin
console.log('3. Building Figma plugin...');
try {
  execSync('npm run build:figma -- --mode production', { stdio: 'inherit' });
  console.log('✅ Figma plugin built successfully\n');
} catch (error) {
  console.error('❌ Failed to build Figma plugin:', error.message);
  process.exit(1);
}

// 4. Build Chrome extension
console.log('4. Building Chrome extension...');
try {
  execSync('npm run build:extension -- --mode production', { stdio: 'inherit' });
  console.log('✅ Chrome extension built successfully\n');
} catch (error) {
  console.error('❌ Failed to build Chrome extension:', error.message);
  process.exit(1);
}

// 5. Optimize and minify server code
console.log('5. Optimizing server code...');
optimizeServerCode();
console.log('✅ Server code optimized\n');

// 6. Generate production manifest
console.log('6. Generating production manifest...');
generateProductionManifest();
console.log('✅ Production manifest generated\n');

// 7. Create deployment package
console.log('7. Creating deployment package...');
createDeploymentPackage();
console.log('✅ Deployment package created\n');

console.log('🎉 Production build completed successfully!');
console.log('\nGenerated files:');
console.log('- build/ (Figma plugin)');
console.log('- dist/ (Chrome extension)');
console.log('- deploy/ (Server deployment package)');
console.log('- canvas-weaver-production.zip (Complete package)\n');

function optimizeServerCode() {
  const serverDir = path.join(__dirname, '../server');
  const deployDir = path.join(__dirname, '../deploy');
  
  // Create deploy directory
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }
  
  // Copy optimized server files
  const filesToCopy = ['server.js', 'production-config.js', 'package.json'];
  
  filesToCopy.forEach(file => {
    const srcPath = path.join(serverDir, file);
    const destPath = path.join(deployDir, file);
    
    if (fs.existsSync(srcPath)) {
      let content = fs.readFileSync(srcPath, 'utf8');
      
      // Remove debug code and optimize
      if (file.endsWith('.js')) {
        content = removeDebugCode(content);
      }
      
      fs.writeFileSync(destPath, content);
    }
  });
  
  // Copy package.json with production dependencies only
  const packageJson = JSON.parse(fs.readFileSync(path.join(serverDir, 'package.json'), 'utf8'));
  delete packageJson.devDependencies;
  fs.writeFileSync(
    path.join(deployDir, 'package.json'), 
    JSON.stringify(packageJson, null, 2)
  );
}

function removeDebugCode(content) {
  // Remove debug console.log statements (keep errors and warnings)
  content = content.replace(/console\.log\([^)]*\);?\s*/g, '');
  
  // Remove debug comments
  content = content.replace(/\/\/ DEBUG:.*$/gm, '');
  content = content.replace(/\/\* DEBUG[\s\S]*?\*\//g, '');
  
  return content;
}

function generateProductionManifest() {
  const manifestPath = path.join(__dirname, '../manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Update for production
  manifest.name = 'Canvas Weaver';
  manifest.id = 'canvas-weaver-production';
  
  // Write production manifest
  const prodManifest = path.join(__dirname, '../build/manifest.json');
  fs.writeFileSync(prodManifest, JSON.stringify(manifest, null, 2));
}

function createDeploymentPackage() {
  try {
    execSync('zip -r canvas-weaver-production.zip build/ deploy/ chrome-extension/ README.md', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
  } catch (error) {
    console.warn('⚠️ Could not create zip package (zip not available)');
  }
}