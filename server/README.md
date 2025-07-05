# Vision API Proxy Server

This server acts as a proxy between your Chrome extension/Figma plugin and the Google Cloud Vision API to solve the CORS restriction issue.

## Why This Server Is Needed

The error `Requests to this API vision.googleapis.com method google.cloud.vision.v1.ImageAnnotator.BatchAnnotateImages are blocked` occurs because Google blocks direct API calls from browser-based applications for security reasons. To solve this, we've created a simple proxy server that:

1. Accepts requests from your Chrome extension and Figma plugin
2. Forwards them to the Google Cloud Vision API
3. Returns the results back to your application

## Setup Instructions

1. Install dependencies:
   ```
   cd server
   npm install
   ```

2. Create a `.env` file based on the `.env.example`:
   ```
   cp .env.example .env
   ```

3. Edit the `.env` file and add your Google Cloud Vision API credentials:
   - Either set `GOOGLE_APPLICATION_CREDENTIALS` to the path of your service account JSON file
   - Or set `GOOGLE_CLOUD_API_KEY` to your API key

4. Start the server:
   ```
   npm start
   ```

## Using the Server

The server exposes the following endpoints:

- `POST /api/analyze`: Analyze an image with the Vision API
  - Body: `{ "image": "base64-encoded-image-data" }`
  - Response: Vision API results

- `GET /health`: Health check endpoint
  - Response: `{ "status": "ok" }`

## Deploying to Production

For production use, deploy this server to a hosting service like:
- Heroku
- Google Cloud Run
- AWS Lambda
- DigitalOcean App Platform

After deploying, update the `PROXY_API_URL` in both:
- Chrome extension: `popup.js`
- Figma plugin: `vision-api-service.ts`

## Security Considerations

- Never expose your API keys in client-side code
- Implement rate limiting and authentication for the proxy server in production
- Consider implementing CORS restrictions to only allow requests from your extension/plugin
