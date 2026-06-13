const geminiService = require('./services/geminiService');

// Mock the model.generateContent method
geminiService.apiKey = 'dummy-key';
geminiService.model = {
  generateContent: async (prompt) => {
    // Determine what to return based on the text passed in prompt
    if (prompt.includes('Mujhe kal subah tractor chahiye')) {
      return {
        response: {
          text: () => JSON.stringify({
            service: 'tractor',
            confidence: 0.95,
            requestedTime: '2026-06-08T08:00:00',
            landArea: null
          })
        }
      };
    } else if (prompt.includes('Need 2 tankers')) {
      return {
        response: {
          text: () => JSON.stringify({
            service: 'tanker',
            confidence: 0.9,
            quantity: '2',
            requestedTime: null
          })
        }
      };
    } else if (prompt.includes('Invalid item request')) {
      return {
        response: {
          text: () => JSON.stringify({
            service: 'invalid-item',
            confidence: 0.2
          })
        }
      };
    }
    // Default fallback
    return {
      response: {
        text: () => JSON.stringify({
          service: 'tractor',
          confidence: 0.5
        })
      }
    };
  }
};

async function runTests() {
  console.log('--- Running TripBlock AI Service Validation Tests ---\n');

  let passed = 0;
  let failed = 0;

  // Test Case 1: Standard case with relative time ("kal subah tractor")
  try {
    const res1 = await geminiService.parseRequest('Mujhe kal subah tractor chahiye');
    console.log('Test Case 1 (Standard Parsing):');
    console.log('  Input: "Mujhe kal subah tractor chahiye"');
    console.log('  Output:', JSON.stringify(res1, null, 2));
    if (res1.service === 'tractor' && res1.requestedTime === '2026-06-08T08:00:00') {
      console.log('  Result: SUCCESS\n');
      passed++;
    } else {
      console.error('  Result: FAILURE (Expected service="tractor", requestedTime="2026-06-08T08:00:00")\n');
      failed++;
    }
  } catch (err) {
    console.error('  Result: FAILURE (Error thrown):', err.message, '\n');
    failed++;
  }

  // Test Case 2: Missing time (should return null or what is parsed)
  try {
    const res2 = await geminiService.parseRequest('Need 2 tankers');
    console.log('Test Case 2 (Quantity Parsing & Missing Time):');
    console.log('  Input: "Need 2 tankers"');
    console.log('  Output:', JSON.stringify(res2, null, 2));

    if (res2.service === 'tanker' && res2.quantity === '2' && res2.requestedTime === null) {
      console.log('  Result: SUCCESS\n');
      passed++;
    } else {
      console.error(`  Result: FAILURE (Expected service="tanker", quantity="2", requestedTime=null)\n`);
      failed++;
    }
  } catch (err) {
    console.error('  Result: FAILURE (Error thrown):', err.message, '\n');
    failed++;
  }

  // Test Case 3: Invalid item (should fail validation)
  try {
    console.log('Test Case 3 (Unsupported Item Validation):');
    console.log('  Input: "Invalid item request"');
    await geminiService.parseRequest('Invalid item request');
    console.error('  Result: FAILURE (Expected validation error but request succeeded)\n');
    failed++;
  } catch (err) {
    if (err.message.includes('Invalid or unsupported item')) {
      console.log(`  Result: SUCCESS (Caught expected validation error: "${err.message}")\n`);
      passed++;
    } else {
      console.error(`  Result: FAILURE (Caught unexpected error: "${err.message}")\n`);
      failed++;
    }
  }

  console.log(`--- Test Summary: ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
