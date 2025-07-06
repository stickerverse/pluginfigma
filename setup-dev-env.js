// Development helper script to load API keys from .env into localStorage
// Run this script with: node setup-dev-env.js
require('dotenv').config();

console.log('Setting up development environment...');

// Create a key-value object with the content to write to localStorage
const localStorageContent = {
  FIGMA_API_KEY: process.env.FIGMA_API_KEY,
  GOOGLE_CLOUD_API_KEY: process.env.GOOGLE_CLOUD_API_KEY
};

// Output instructions for manually setting localStorage in browser console
console.log('\nRun these commands in your browser console to set API keys:');
console.log('-------------------------------------------------------');
console.log(`localStorage.setItem('FIGMA_API_KEY', '${process.env.FIGMA_API_KEY}');`);
console.log(`localStorage.setItem('GOOGLE_CLOUD_API_KEY', '${process.env.GOOGLE_CLOUD_API_KEY}');`);
console.log('-------------------------------------------------------');

console.log('\nEnvironment variables loaded:');
console.log(`FIGMA_API_KEY: ${process.env.FIGMA_API_KEY ? '✓ Loaded' : '✗ Missing'}`);
console.log(`GOOGLE_CLOUD_API_KEY: ${process.env.GOOGLE_CLOUD_API_KEY ? '✓ Loaded' : '✗ Missing'}`);
