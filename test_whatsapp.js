const http = require('http');
const fs = require('fs');
const path = require('path');

const geminiService = require('./services/geminiService');
const sttService = require('./services/sttService');
const downloadService = require('./services/downloadService');

// Mock downloadService.downloadMedia so we don't hit the internet during tests
downloadService.downloadMedia = async (url, contentType) => {
  console.log(`  [Mock DownloadService] Intercepted download for: ${url}`);
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
  const tempPath = path.join(uploadsDir, `twilio_test_audio.ogg`);
  fs.writeFileSync(tempPath, 'dummy audio data');
  return tempPath;
};

// Mock sttService.transcribe so we don't hit the Sarvam AI STT API
sttService.transcribe = async (filePath) => {
  console.log(`  [Mock SttService] Intercepted STT for file: ${filePath}`);
  return 'Mujhe kal subah tractor chahiye';
};

// Mock geminiService.parseRequest so we don't hit the Gemini API
geminiService.parseRequest = async (text) => {
  console.log(`  [Mock GeminiService] Intercepted Gemini parsing for: "${text}"`);
  if (text.includes('Hello')) {
    return {
      service: 'unknown',
      confidence: 0.2
    };
  }
  return {
    service: 'tractor',
    item: 'tractor',
    confidence: 0.95,
    requestedTime: '2026-06-08T08:00:00',
    landArea: null
  };
};

// Mock geminiService.parseFollowUp so we don't hit the Gemini API
geminiService.parseFollowUp = async (text, service, waitingFor) => {
  console.log(`  [Mock GeminiService] Intercepted Gemini follow-up parsing for: "${text}"`);
  if (waitingFor === 'landArea') {
    return {
      extractedValue: '3 acre',
      confidence: 0.95
    };
  }
  return {
    extractedValue: text,
    confidence: 0.9
  };
};

// Start the server on a test port (3002) to prevent conflicts
process.env.PORT = 3002;
require('./server.js');

// Helper to make URL-encoded POST requests
function postURLEncoded(path, bodyObj) {
  return new Promise((resolve, reject) => {
    const postData = Object.keys(bodyObj)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(bodyObj[key]))
      .join('&');

    const req = http.request({
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseBody
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('--- Running WhatsApp Webhook Integration Tests (Stateful Intent + Follow-up) ---\n');

  let passed = 0;
  let failed = 0;

  // Wait 1.5 seconds for the server to start listening
  await new Promise(resolve => setTimeout(resolve, 1500));

  const testPhoneNumber = 'whatsapp:+919876543210';
  const alternativePhoneNumber = 'whatsapp:+919999999999';

  // Test 1: Send Voice Note (Should initialize active state and ask follow-up question in Hindi for landArea)
  try {
    console.log('Test 1: Send Voice Note (Expect Hindi follow-up question for landArea):');
    const payload = {
      From: testPhoneNumber,
      Body: '',
      NumMedia: '1',
      MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/ACxxx/Messages/MMxxx/Media/MExxx',
      MediaContentType0: 'audio/ogg'
    };
    const res = await postURLEncoded('/whatsapp', payload);
    console.log('  Status:', res.statusCode);
    const bodyMatch = res.body.includes('ट्रैक्टर कितनी ज़मीन के लिए चाहिए?');
    console.log('  Body contains correct follow-up question:', bodyMatch);

    if (res.statusCode === 200 && bodyMatch) {
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

  // Test 2: Send Follow-up Answer for landArea (Expect follow-up question in Hindi for location)
  try {
    console.log('Test 2: Send Follow-up Answer for landArea (Expect location request prompt):');
    const payload = {
      From: testPhoneNumber,
      Body: '3 acre',
      NumMedia: '0'
    };
    const res = await postURLEncoded('/whatsapp', payload);
    console.log('  Status:', res.statusCode);
    const bodyMatch = res.body.includes('📍 कृपया अपनी लोकेशन शेयर करें।');
    console.log('  Body contains location prompt:', bodyMatch);

    if (res.statusCode === 200 && bodyMatch) {
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

  // Test 3: Send Location Coordinates (Expect Hindi completion confirmation message)
  try {
    console.log('Test 3: Send Location Coordinates (Expect completed confirmation message):');
    const payload = {
      From: testPhoneNumber,
      Body: '',
      Latitude: '19.0760',
      Longitude: '72.8777',
      NumMedia: '0'
    };
    const res = await postURLEncoded('/whatsapp', payload);
    console.log('  Status:', res.statusCode);
    const bodyMatch = res.body.includes('सफलतापूर्वक दर्ज') && res.body.includes('Mumbai') && res.body.includes('Maharashtra');
    console.log('  Body contains completion confirmation:', bodyMatch);

    if (res.statusCode === 200 && bodyMatch) {
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

  // Test 4: Send Text message with unknown service (Expect fallback clarification in Hindi)
  try {
    console.log('Test 4: Send Text Message with unknown service (Expect clarification response in Hindi):');
    const payload = {
      From: alternativePhoneNumber,
      Body: 'Hello, I want to request something.',
      NumMedia: '0'
    };
    const res = await postURLEncoded('/whatsapp', payload);
    console.log('  Status:', res.statusCode);
    const bodyMatch = res.body.includes('मुझे समझ नहीं आया। आपको कौन सी सेवा चाहिए?');
    console.log('  Body contains Hindi clarification TwiML:', bodyMatch);

    if (res.statusCode === 200 && bodyMatch) {
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

  console.log(`--- WhatsApp Test Summary: ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
