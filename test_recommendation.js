const http = require('http');
const recommendationService = require('./services/recommendationService');

// Start the server on a test port (3003) to prevent conflicts with 3000/3001/3002
process.env.PORT = 3003;
require('./server.js');

// Helper to make POST requests
function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3003,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
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

async function runTests() {
  console.log('--- Running Provider Recommendation Engine Tests ---\n');

  let passed = 0;
  let failed = 0;

  // Wait 1.5 seconds for the server to start listening on port 3003
  await new Promise(resolve => setTimeout(resolve, 1500));

  const tripBlock = {
    tripBlockId: "TB-101",
    service: "water_tanker",
    farmers: 3,
    requiredCapacity: 5000,
    location: {
      lat: 23.25,
      lng: 77.52
    },
    requestedTime: "tomorrow_morning"
  };

  const rameshProvider = {
    id: "P1",
    name: "Ramesh Tanker Services",
    service: "water_tanker",
    location: {
      lat: 23.27,
      lng: 77.50
    },
    rating: 4.8,
    capacity: 5000,
    available: true,
    completedJobs: 143
  };

  const mohanProvider = {
    id: "P2",
    name: "Mohan Tanker Services",
    service: "water_tanker",
    location: {
      lat: 23.35,
      lng: 77.60
    },
    rating: 4.2,
    capacity: 6000,
    available: true,
    completedJobs: 80
  };

  // Test Case 1: Single provider available
  try {
    console.log('Test Case 1: Single provider available');
    const res = recommendationService.recommendProvider(tripBlock, [rameshProvider]);
    
    if (
      res.recommendedProvider === "Ramesh Tanker Services" &&
      res.matchScore > 0 &&
      res.reasons.includes("Capacity matches requirement") &&
      res.reasonsHindi.includes("पर्याप्त क्षमता उपलब्ध है") &&
      res.rankings.length === 1 &&
      res.rankings[0].provider === "Ramesh Tanker Services"
    ) {
      console.log('  Result: SUCCESS\n');
      passed++;
    } else {
      console.error('  Result: FAILURE. Output:', JSON.stringify(res, null, 2), '\n');
      failed++;
    }
  } catch (err) {
    console.error('  Result: FAILURE (Error thrown):', err.message, '\n');
    failed++;
  }

  // Test Case 2: Multiple providers available
  try {
    console.log('Test Case 2: Multiple providers available');
    const res = recommendationService.recommendProvider(tripBlock, [mohanProvider, rameshProvider]);
    
    if (
      res.recommendedProvider === "Ramesh Tanker Services" &&
      res.rankings.length === 2 &&
      res.rankings[0].score >= res.rankings[1].score
    ) {
      console.log('  Result: SUCCESS\n');
      passed++;
    } else {
      console.error('  Result: FAILURE. Output:', JSON.stringify(res, null, 2), '\n');
      failed++;
    }
  } catch (err) {
    console.error('  Result: FAILURE (Error):', err.message, '\n');
    failed++;
  }

  // Test Case 3: Best provider selected by score (verify weights)
  try {
    console.log('Test Case 3: Best provider selected by score');
    const closeProvider = {
      id: "P3",
      name: "Close Services",
      service: "water_tanker",
      location: { lat: 23.251, lng: 77.521 }, // very close
      rating: 3.0,
      capacity: 5000,
      available: true,
      completedJobs: 10
    };
    const farExperiencedProvider = {
      id: "P4",
      name: "Far Experienced Services",
      service: "water_tanker",
      location: { lat: 23.45, lng: 77.72 }, // far
      rating: 5.0,
      capacity: 5000,
      available: true,
      completedJobs: 150
    };

    const res = recommendationService.recommendProvider(tripBlock, [farExperiencedProvider, closeProvider]);
    
    // CloseProvider should win because distance weight is 30%, whereas rating + completed jobs is 20% total
    if (res.recommendedProvider === "Close Services") {
      console.log('  Result: SUCCESS. Recommended Close Services over Far Experienced Services.\n');
      passed++;
    } else {
      console.error('  Result: FAILURE. Output:', JSON.stringify(res, null, 2), '\n');
      failed++;
    }
  } catch (err) {
    console.error('  Result: FAILURE (Error):', err.message, '\n');
    failed++;
  }

  // Test Case 4: No provider available
  try {
    console.log('Test Case 4: No provider available');
    const res = recommendationService.recommendProvider(tripBlock, []);
    
    if (
      res.status === "no_provider_found" &&
      res.message === "कोई उपयुक्त प्रदाता उपलब्ध नहीं है।"
    ) {
      console.log('  Result: SUCCESS\n');
      passed++;
    } else {
      console.error('  Result: FAILURE. Output:', JSON.stringify(res, null, 2), '\n');
      failed++;
    }
  } catch (err) {
    console.error('  Result: FAILURE (Error):', err.message, '\n');
    failed++;
  }

  // Test Case 5: Capacity mismatch handling
  try {
    console.log('Test Case 5: Capacity mismatch handling');
    const undersizedProvider = {
      id: "P5",
      name: "Small Tanker Services",
      service: "water_tanker",
      location: { lat: 23.27, lng: 77.50 },
      rating: 4.9,
      capacity: 3000, // less than 5000 required
      available: true,
      completedJobs: 100
    };
    const res = recommendationService.recommendProvider(tripBlock, [undersizedProvider]);
    
    if (
      res.status === "no_provider_found" &&
      res.message === "कोई उपयुक्त प्रदाता उपलब्ध नहीं है।"
    ) {
      console.log('  Result: SUCCESS\n');
      passed++;
    } else {
      console.error('  Result: FAILURE. Output:', JSON.stringify(res, null, 2), '\n');
      failed++;
    }
  } catch (err) {
    console.error('  Result: FAILURE (Error):', err.message, '\n');
    failed++;
  }

  // Test Case 6: API Endpoint verification (POST /api/provider-recommendation)
  try {
    console.log('Test Case 6: POST /api/provider-recommendation API Endpoint');
    const response = await post('/api/provider-recommendation', {
      tripBlock,
      providers: [mohanProvider, rameshProvider]
    });

    console.log('  HTTP Status:', response.statusCode);
    const body = response.body;

    if (
      response.statusCode === 200 &&
      body.recommendedProvider === "Ramesh Tanker Services" &&
      body.reasons.length > 0 &&
      body.reasonsHindi.length > 0 &&
      body.rankings.length === 2
    ) {
      console.log('  Result: SUCCESS\n');
      passed++;
    } else {
      console.error('  Result: FAILURE. HTTP Response Body:', JSON.stringify(body, null, 2), '\n');
      failed++;
    }
  } catch (err) {
    console.error('  Result: FAILURE (Error during API call):', err.message, '\n');
    failed++;
  }

  console.log(`--- Test Summary: ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
