import { API_CONFIG } from '../config';

/**
 * Service for interacting with Figma's REST API
 * This complements the Plugin API by allowing access to additional Figma features
 */
export class FigmaApiService {
  private apiKey: string;
  private baseUrl: string = 'https://api.figma.com/v1';

  constructor(apiKey: string = API_CONFIG.FIGMA_API_KEY) {
    this.apiKey = apiKey;
  }

  /**
   * Get file information from Figma API
   * @param fileId The Figma file ID
   */
  async getFile(fileId: string) {
    return this.request(`/files/${fileId}`);
  }

  /**
   * Get components from a Figma file
   * @param fileId The Figma file ID
   */
  async getFileComponents(fileId: string) {
    return this.request(`/files/${fileId}/components`);
  }

  /**
   * Get styles from a Figma file
   * @param fileId The Figma file ID
   */
  async getFileStyles(fileId: string) {
    return this.request(`/files/${fileId}/styles`);
  }

  /**
   * Search for published components in the Figma Community
   * @param query Search query
   */
  async searchComponents(query: string) {
    return this.request(`/search/components?query=${encodeURIComponent(query)}`);
  }

  /**
   * Generic request method for Figma API
   * @param endpoint API endpoint
   * @param options Fetch options
   */
  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'X-Figma-Token': this.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`Figma API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Figma API request failed:', error);
      throw error;
    }
  }

  /**
   * Import styles from another Figma file
   * @param fileId Source file ID
   * @param styleIds Array of style IDs to import
   */
  async importStyles(fileId: string, styleIds: string[]) {
    // This would typically be implemented using the Plugin API
    // since direct style imports aren't available via the REST API
    console.log('Importing styles from file:', fileId, 'styles:', styleIds);
    return {
      success: true,
      message: 'This would import styles in a real implementation'
    };
  }

  /**
   * Find similar components based on an image
   * This combines the Figma API with our image analysis results
   * @param imageAnalysisResult The analysis results from our Vision API
   */
  async findSimilarComponents(imageAnalysisResult: any) {
    // Example: search for components based on detected labels or text
    const searchTerms = [];
    
    // Extract potential search terms from the analysis
    if (imageAnalysisResult.components && imageAnalysisResult.components.length > 0) {
      searchTerms.push(imageAnalysisResult.components[0].name);
    }
    
    // If we have text, add that to search terms
    if (imageAnalysisResult.typography && imageAnalysisResult.typography.length > 0) {
      const textContent = imageAnalysisResult.typography[0].text;
      if (textContent && textContent.length > 3) {
        searchTerms.push(textContent);
      }
    }
    
    // Search for components that might match our analyzed image
    if (searchTerms.length > 0) {
      return this.searchComponents(searchTerms.join(' '));
    }
    
    return { components: [] };
  }
}
