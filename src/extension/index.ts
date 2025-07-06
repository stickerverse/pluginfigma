/**
 * Chrome Extension Enhanced Components
 * Entry point for the enhanced capture and content modules
 */

export * from './capture';
export * from './content';

// Initialize extension components when loaded
export async function initializeExtension(): Promise<void> {
  // Ensure DOM is ready
  if (document.readyState === 'loading') {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve);
    });
  }
  
  console.log('Sticker Chrome Extension enhanced components initialized');
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initializeExtension().catch(console.error);
}