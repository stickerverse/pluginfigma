import { render } from '@create-figma-plugin/ui';
import { h } from 'preact';
import { useState } from 'preact/hooks';

function Plugin() {
  const [status, setStatus] = useState('Ready');
  
  const handleClose = () => {
    parent.postMessage({ pluginMessage: { type: 'close' } }, '*');
  };
  
  const handleAnalyze = () => {
    setStatus('Analyzing...');
    setTimeout(() => {
      parent.postMessage({ 
        pluginMessage: { 
          type: 'IMAGE_ANALYSIS_COMPLETE',
          data: { success: true }
        } 
      }, '*');
      setStatus('Analysis complete!');
    }, 1000);
  };
  
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Stickerverse Plugin</h2>
      <p>Status: {status}</p>
      
      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={handleAnalyze}
          style={{
            background: '#18a0fb',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Analyze Image
        </button>
        
        <button 
          onClick={handleClose}
          style={{
            background: '#f0f0f0',
            color: '#333',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default render(Plugin);
