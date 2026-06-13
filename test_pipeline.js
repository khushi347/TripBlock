const http = require('http');
const geminiService = require('./services/geminiService');

// Mock geminiService.parseRequest so this script runs without needing a live GEMINI_API_KEY
geminiService.parseRequest = async (text) => {
  console.log(`  [Mock Gemini] Parsing text: "${text}"`);
  return {
    item: 'tractor',
    quantity: 1,
    requestedTime: '2026-06-08T08:00:00'
  };
};

// Start the server on a test port (3001) to prevent conflicts with 3000
process.env.PORT = 3001;
require('./server.js');

// Helper to make POST requests
function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(responseBody);
        } catch {
          parsed = responseBody;
        }
        resolve({
          statusCode: res.statusCode,
          body: parsed
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

// Helper to make GET requests
function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3001${path}`, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: JSON.parse(responseBody)
        });
      });
    }).on('error', (err) => reject(err));
  });
}

async function runTests() {
  console.log('--- Running TripBlock AI Pipeline End-to-End Tests ---\n');

  let passed = 0;
  let failed = 0;

  // Wait 1.5 seconds for the server to start listening on port 3001
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Test 1: GET /health
  try {
    const res = await get('/health');
    console.log('Test 1 (GET /health):');
    console.log('  Status:', res.statusCode);
    console.log('  Body:', res.body);
    if (res.statusCode === 200 && res.body.status === 'ok') {
      console.log('  Result: SUCCESS\n');
      passed++;
    } else {
      console.error('  Result: FAILURE\n');
      failed++;
    }
  } catch (err) {
    console.error('  Result: FAILURE (Error thrown):', err.message, '\n');
    failed++;
  }

  // Test 2: POST /voice-request
  try {
    const res = await post('/voice-request', {
      phone: '+919876543210',
      audioUrl: 'http://example.com/recording.wav'
    });
    console.log('Test 2 (POST /voice-request):');
    console.log('  Status:', res.statusCode);
    console.log('  Body:', JSON.stringify(res.body, null, 2));
    if (
      res.statusCode === 200 &&
      res.body.transcription === 'Mujhe kal subah tractor chahiye' &&
      res.body.backendResponse.success &&
      res.body.notification.sent &&
      res.body.notification.message.includes('आपके साथ 2 और किसान हैं।')
    ) {
      console.log('  Result: SUCCESS\n');
      passed++;
    } else {
      console.error('  Result: FAILURE\n');
      failed++;
    }
  } catch (err) {
    console.error('  Result: FAILURE (Error thrown):', err.message, '\n');
    failed++;
  }

  // Test 3: POST /fallback-request (Valid manual entry)
  try {
    const res = await post('/fallback-request', {
      phone: '+919876543210',
      item: 'tanker',
      quantity: 2,
      requestedTime: '2026-06-09T12:00:00'
    });
    console.log('Test 3 (POST /fallback-request - Valid Manual Entry):');
    console.log('  Status:', res.statusCode);
    console.log('  Body:', JSON.stringify(res.body, null, 2));
    if (
      res.statusCode === 200 &&
      res.body.backendResponse.tripBlock.item === 'tanker' &&
      res.body.notification.sent
    ) {
      console.log('  Result: SUCCESS\n');
      passed++;
    } else {
      console.error('  Result: FAILURE\n');
      failed++;
    }
  } catch (err) {
    console.error('  Result: FAILURE (Error thrown):', err.message, '\n');
    failed++;
  }

  // Test 4: POST /fallback-request (Invalid item validation)
  try {
    const res = await post('/fallback-request', {
      phone: '+919876543210',
      item: 'invalid-item'
    });
    console.log('Test 4 (POST /fallback-request - Invalid Item Validation):');
    console.log('  Status:', res.statusCode);
    console.log('  Body:', res.body);
    if (res.statusCode === 400 && res.body.error.includes('Invalid or unsupported item')) {
      console.log('  Result: SUCCESS\n');
      passed++;
    } else {
      console.error('  Result: FAILURE\n');
      failed++;
    }
  } catch (err) {
    console.error('  Result: FAILURE (Error thrown):', err.message, '\n');
    failed++;
  }

  console.log(`--- Test Summary: ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
