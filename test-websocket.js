const WebSocket = require('ws');

console.log('Testing Canvas Weaver WebSocket connection...');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');
  
  // Identify as test client
  ws.send(JSON.stringify({
    type: 'identify',
    id: 'figma'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📨 Received message:', message);
  
  if (message.type === 'identified') {
    console.log('✅ Successfully identified with server');
    
    // Test image processing
    console.log('🧪 Testing image processing...');
    ws.send(JSON.stringify({
      type: 'processImage',
      base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      options: {
        useSegmentation: true,
        useOCR: true,
        useVectorization: true,
        outputFormat: 'figma-component'
      }
    }));
  } else if (message.type === 'processedImage') {
    console.log('✅ Image processing completed successfully!');
    console.log('📊 Processed data:', JSON.stringify(message.data, null, 2));
    process.exit(0);
  } else if (message.type === 'processingError') {
    console.error('❌ Processing error:', message.error);
    process.exit(1);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
  process.exit(1);
});

ws.on('close', () => {
  console.log('🔌 WebSocket connection closed');
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timed out');
  process.exit(1);
}, 10000);