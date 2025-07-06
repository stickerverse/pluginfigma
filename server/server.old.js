const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for extension requests
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Default API key from env (optional, can be overridden in requests)
const DEFAULT_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;

app.post('/api/analyze', async (req, res) => {
  try {
    // Get base64 image and API key from request body
    const { image, apiKey } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }
    
    // Use API key from request or fall back to default
    const key = apiKey || DEFAULT_API_KEY;
    
    if (!key) {
      return res.status(400).json({ 
        error: 'No API key provided',
        details: 'Please provide an API key in the request or set GOOGLE_CLOUD_API_KEY in the server environment'
      });
    }
    
    // Prepare Vision API request body
    const visionRequest = {
      requests: [
        {
          image: { content: image },
          features: [
            { type: 'LABEL_DETECTION', maxResults: 10 },
            { type: 'TEXT_DETECTION' },
            { type: 'OBJECT_LOCALIZATION' },
            { type: 'IMAGE_PROPERTIES' },
            { type: 'DOCUMENT_TEXT_DETECTION' }
          ]
        }
      ]
    };
    
    // Call Vision API directly using axios
    const visionResponse = await axios({
      method: 'post',
      url: `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: visionRequest
    });
    
    // Return the API response
    res.json(visionResponse.data);
  } catch (error) {
    console.error('Vision API error:', error);
    
    // Handle axios errors
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx
      return res.status(error.response.status).json({
        error: 'Google Vision API error',
        details: error.response.data.error || error.message,
        status: error.response.status
      });
    } else if (error.request) {
      // The request was made but no response was received
      return res.status(500).json({
        error: 'Failed to connect to Google Vision API',
        details: 'No response received'
      });
    } else {
      // Something happened in setting up the request
      return res.status(500).json({ 
        error: 'Failed to analyze image',
        details: error.message 
      });
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Vision API proxy server listening at http://localhost:${port}`);
});
