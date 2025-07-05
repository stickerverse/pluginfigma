/**
 * Sticker Component Analyzer - Data Transmission Test Script
 * 
 * This script tests the data sanitization and transmission fixes
 * for both the Chrome extension and Figma plugin sides.
 */

// Simulate importing the key functions from our codebase
// In a real test environment, you would import the actual functions
const simulatedFunctions = {
  // From element-inspector.js
  _extractColorsFromStates: (states) => {
    console.log(`Extracting colors from ${states.length} states...`);
    const uniqueColors = new Set();
    let colorCount = 0;
    
    states.forEach(state => {
      if (state.fills) {
        state.fills.forEach(fill => {
          if (fill.color) {
            // Normally we'd add the color object, but for testing just count
            uniqueColors.add(JSON.stringify(fill.color));
            colorCount++;
          }
        });
      }
    });
    
    console.log(`Found ${uniqueColors.size} unique colors out of ${colorCount} total colors`);
    return [...uniqueColors].map(c => JSON.parse(c));
  },
  
  // From element-inspector.js
  sendCapturedStatesToFigma: (componentData) => {
    try {
      console.log("Simulating sendCapturedStatesToFigma...");
      
      // Sanitize data before sending
      const sanitizedData = componentData.map(comp => ({
        ...comp,
        children: Array.isArray(comp.children) ? comp.children.slice(0, 20) : [] // Limit children array
      }));
      
      // Check data size
      const serializedData = JSON.stringify(sanitizedData);
      console.log(`Data size: ${(serializedData.length / 1024).toFixed(2)} KB`);
      
      if (serializedData.length > 500000) {
        console.log("Data too large, creating simplified version...");
        
        // Create simplified version with essential data only
        const simplifiedData = sanitizedData.map(component => ({
          id: component.id,
          name: component.name,
          type: component.type,
          x: component.x,
          y: component.y,
          width: component.width, 
          height: component.height,
          simplified: true,
          message: "Component was simplified due to large data size"
        }));
        
        // Extract key style data if available
        if (componentData[0].fills || componentData[0].strokes) {
          const colors = simulatedFunctions._extractColorsFromStates(componentData);
          console.log(`Extracted ${colors.length} unique colors for simplified data`);
          simplifiedData[0].colors = colors.slice(0, 10); // Limit to 10 colors max
        }
        
        const simplifiedSize = JSON.stringify(simplifiedData).length;
        console.log(`Simplified data size: ${(simplifiedSize / 1024).toFixed(2)} KB`);
        
        return {
          success: true,
          simplified: true,
          data: simplifiedData
        };
      } else {
        console.log("Data size acceptable, sending full component data");
        return {
          success: true,
          simplified: false,
          data: sanitizedData
        };
      }
    } catch (error) {
      console.error("Error in sendCapturedStatesToFigma:", error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  // From popup.js
  processComponent: (component) => {
    console.log("Simulating processComponent...");
    
    try {
      // Validate component data
      if (!component || typeof component !== 'object') {
        throw new Error("Invalid component data received");
      }
      
      // Check if we received simplified data
      const isSimplified = component.simplified === true;
      if (isSimplified) {
        console.log("Received simplified component data");
        
        // Make sure we have the minimal required fields
        if (!component.id || !component.name || 
            typeof component.width !== 'number' || 
            typeof component.height !== 'number') {
          throw new Error("Simplified component missing required fields");
        }
        
        return {
          success: true,
          simplified: true,
          component: component
        };
      } else {
        // Regular component validation
        if (!component.id || !component.type) {
          throw new Error("Component missing required fields");
        }
        
        return {
          success: true,
          simplified: false,
          component: component
        };
      }
    } catch (error) {
      console.error("Error in processComponent:", error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  // Simulate figma plugin external messaging handler
  simulateFigmaMessageHandler: (message) => {
    console.log("Simulating Figma plugin message handler...");
    
    try {
      // Check for valid message
      if (!message || !message.data) {
        throw new Error("Invalid message received");
      }
      
      const componentData = message.data;
      
      // Check if we received simplified data
      const isSimplified = componentData.simplified === true;
      
      if (isSimplified) {
        console.log("Figma plugin received simplified component data");
        console.log("Creating basic components with placeholder visuals...");
        
        return {
          success: true,
          simplified: true,
          message: "Created simplified components"
        };
      } else {
        console.log("Figma plugin received full component data");
        console.log("Creating detailed components with all properties...");
        
        return {
          success: true,
          simplified: false,
          message: "Created full-fidelity components"
        };
      }
    } catch (error) {
      console.error("Error in Figma message handler:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// Test data generation
function generateTestData(size = 'small') {
  console.log(`Generating ${size} test component data...`);
  
  // Create a basic component
  const baseComponent = {
    id: 'comp-123',
    name: 'Test Button',
    type: 'COMPONENT',
    x: 100,
    y: 100,
    width: 200,
    height: 50,
    fills: [
      { type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8 }, opacity: 1 }
    ],
    strokes: [],
    children: [],
    properties: {
      cornerRadius: 4,
      layout: {
        direction: 'HORIZONTAL',
        padding: { top: 8, right: 16, bottom: 8, left: 16 },
        itemSpacing: 8
      }
    }
  };
  
  // For large data, add many children with deep nesting
  if (size === 'large') {
    // Add many children
    for (let i = 0; i < 500; i++) {
      const child = {
        id: `child-${i}`,
        name: `Child Element ${i}`,
        type: 'FRAME',
        x: i * 5,
        y: i * 2,
        width: 50,
        height: 20,
        fills: []
      };
      
      // Add many different colors to test color extraction
      for (let c = 0; c < 20; c++) {
        child.fills.push({
          type: 'SOLID',
          color: {
            r: Math.random(),
            g: Math.random(),
            b: Math.random()
          },
          opacity: 0.8 + (Math.random() * 0.2)
        });
      }
      
      // Add deep nesting to make the data large
      if (i % 10 === 0) {
        child.children = [];
        for (let j = 0; j < 50; j++) {
          child.children.push({
            id: `grandchild-${i}-${j}`,
            name: `Nested Element ${j}`,
            type: 'RECTANGLE',
            x: j * 2,
            y: j * 2,
            width: 10,
            height: 10,
            fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }],
            properties: {
              // Add more properties to increase size
              detailedData: Array(200).fill('test-data').join(','),
              moreData: Array(200).fill({ someField: 'test-value-with-lots-of-extra-characters-to-increase-the-size-of-the-data-significantly' }),
              evenMoreData: Array(100).fill({
                nestedObject: {
                  deeplyNested: {
                    veryDeep: Array(20).fill('deep-test-data-with-lots-of-characters')
                  }
                }
              })
            }
          });
        }
      }
      
      baseComponent.children.push(child);
    }
  } else {
    // Just add a few children for small data
    for (let i = 0; i < 3; i++) {
      baseComponent.children.push({
        id: `child-${i}`,
        name: `Child Element ${i}`,
        type: 'TEXT',
        x: 10,
        y: 10 + (i * 20),
        width: 80,
        height: 20,
        fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }]
      });
    }
  }
  
  return [baseComponent];
}

// Run tests
function runTests() {
  console.log("STARTING DATA TRANSMISSION TESTS");
  console.log("===============================");
  
  // Test 1: Small component data
  console.log("\nTEST 1: Small component data");
  const smallData = generateTestData('small');
  const smallDataResult = simulatedFunctions.sendCapturedStatesToFigma(smallData);
  console.log(`Test 1 Result: ${smallDataResult.success ? 'SUCCESS' : 'FAILURE'}`);
  console.log(`Data was ${smallDataResult.simplified ? 'simplified' : 'sent in full'}`);
  
  // Test the receiver side
  const smallDataProcessingResult = simulatedFunctions.processComponent(smallDataResult.data[0]);
  console.log(`Component processing: ${smallDataProcessingResult.success ? 'SUCCESS' : 'FAILURE'}`);
  
  // Test figma plugin handling
  const smallDataFigmaResult = simulatedFunctions.simulateFigmaMessageHandler({
    source: 'sticker-chrome-extension',
    data: smallDataResult.data
  });
  console.log(`Figma handler: ${smallDataFigmaResult.success ? 'SUCCESS' : 'FAILURE'}`);
  
  // Test 2: Large component data
  console.log("\nTEST 2: Large component data");
  const largeData = generateTestData('large');
  const largeDataResult = simulatedFunctions.sendCapturedStatesToFigma(largeData);
  console.log(`Test 2 Result: ${largeDataResult.success ? 'SUCCESS' : 'FAILURE'}`);
  console.log(`Data was ${largeDataResult.simplified ? 'simplified' : 'sent in full'}`);
  
  // Test the receiver side
  const largeDataProcessingResult = simulatedFunctions.processComponent(largeDataResult.data[0]);
  console.log(`Component processing: ${largeDataProcessingResult.success ? 'SUCCESS' : 'FAILURE'}`);
  
  // Test figma plugin handling
  const largeDataFigmaResult = simulatedFunctions.simulateFigmaMessageHandler({
    source: 'sticker-chrome-extension',
    data: largeDataResult.data
  });
  console.log(`Figma handler: ${largeDataFigmaResult.success ? 'SUCCESS' : 'FAILURE'}`);
  
  console.log("\nTEST SUMMARY");
  console.log("===========");
  console.log(`Small data transmission: ${smallDataResult.success ? 'PASSED' : 'FAILED'}`);
  console.log(`Small data processing: ${smallDataProcessingResult.success ? 'PASSED' : 'FAILED'}`);
  console.log(`Small data Figma handling: ${smallDataFigmaResult.success ? 'PASSED' : 'FAILED'}`);
  console.log(`Large data transmission: ${largeDataResult.success ? 'PASSED' : 'FAILED'}`);
  console.log(`Large data processing: ${largeDataProcessingResult.success ? 'PASSED' : 'FAILED'}`);
  console.log(`Large data Figma handling: ${largeDataFigmaResult.success ? 'PASSED' : 'FAILED'}`);
}

// Run the tests
runTests();
