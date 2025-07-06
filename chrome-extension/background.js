// Background script for Image Analyzer extension

// Handle installation or update
chrome.runtime.onInstalled.addListener(function() {
  console.log('Image Analyzer extension installed or updated');
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // You can add more background functionality here if needed
  return true;
});
