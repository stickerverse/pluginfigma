// Content script for Image Analyzer extension

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "findImages") {
    // Find all images on the page
    const images = Array.from(document.querySelectorAll('img'))
      .filter(img => {
        // Filter out very small images and icons
        return img.naturalWidth > 100 && img.naturalHeight > 100 && img.src;
      })
      .map(img => {
        return {
          src: img.src,
          width: img.naturalWidth,
          height: img.naturalHeight,
          alt: img.alt || ''
        };
      });
    
    // Send back the list of images
    sendResponse({ images: images });
  }
  
  return true; // Keep the message channel open for async response
});
