const fs = require('fs');
const path = require('path');

/**
 * Downloads a media file from Twilio and saves it temporarily to the uploads directory.
 * Supports HTTP Basic Authentication and handles redirection without forwarding sensitive headers.
 * 
 * @param {string} url - The URL to download the media from (e.g. MediaUrl0)
 * @param {string} contentType - The content type of the media (e.g. MediaContentType0)
 * @param {string} webhookAccountSid - Account SID received in the Twilio webhook payload
 * @returns {Promise<string>} Path to the temporarily saved file
 */
async function downloadMedia(url, contentType, webhookAccountSid) {
  if (!url) {
    throw new Error('downloadMedia: url is required');
  }

  // --- Task 1: Verify SID and Auth Token are loaded ---
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  console.log('[DownloadService] Investigating environment variables:');
  if (accountSid) {
    console.log('[DownloadService] TWILIO_ACCOUNT_SID is successfully loaded from environment.');
  } else {
    console.warn('[DownloadService] WARNING: TWILIO_ACCOUNT_SID is missing from environment variables!');
  }
  if (authToken) {
    console.log('[DownloadService] TWILIO_AUTH_TOKEN is successfully loaded from environment.');
  } else {
    console.warn('[DownloadService] WARNING: TWILIO_AUTH_TOKEN is missing from environment variables!');
  }

  // --- Task 2: Log masked SID ---
  if (accountSid) {
    const maskedSid = accountSid.substring(0, 4) + '...' + accountSid.substring(accountSid.length - 4);
    console.log(`[DownloadService] Active TWILIO_ACCOUNT_SID: ${maskedSid}`);
  }

  // --- Task 3: Verify SID matches webhook AccountSid ---
  if (webhookAccountSid) {
    const maskedWebhookSid = webhookAccountSid.substring(0, 4) + '...' + webhookAccountSid.substring(webhookAccountSid.length - 4);
    console.log(`[DownloadService] Webhook payload AccountSid: ${maskedWebhookSid}`);
    if (accountSid && webhookAccountSid !== accountSid) {
      console.warn(`[DownloadService] WARNING: TWILIO_ACCOUNT_SID in environment does not match AccountSid in Twilio webhook payload!`);
    } else {
      console.log(`[DownloadService] AccountSid match verified: payload matches environment configuration.`);
    }
  }

  // --- Task 4: Verify Auth Token structure (checking if it is standard 32-char hex token) ---
  if (authToken) {
    const isHex32 = /^[0-9a-fA-F]{32}$/.test(authToken);
    console.log(`[DownloadService] Auth Token details: Length = ${authToken.length}, Valid 32-char hex = ${isHex32}`);
    if (!isHex32) {
      console.warn(`[DownloadService] WARNING: TWILIO_AUTH_TOKEN does not look like a standard Twilio Auth Token (expected 32-character hex). Make sure you did not input an API Key or API Secret.`);
    }
  }

  // Determine extension based on content type
  let extension = 'ogg'; // Default to ogg since WhatsApp audio is typically ogg
  if (contentType) {
    const lowerType = contentType.toLowerCase();
    if (lowerType.includes('ogg')) extension = 'ogg';
    else if (lowerType.includes('amr')) extension = 'amr';
    else if (lowerType.includes('wav')) extension = 'wav';
    else if (lowerType.includes('mpeg')) extension = 'mp3';
    else if (lowerType.includes('mp3')) extension = 'mp3';
    else if (lowerType.includes('aac')) extension = 'aac';
    else if (lowerType.includes('m4a')) extension = 'm4a';
  }

  // Ensure upload directory exists
  const uploadDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `twilio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;
  const destPath = path.join(uploadDir, filename);

  // --- Task 6: Construct HTTP Basic Authorization header ---
  const headers = {};
  if (accountSid && authToken) {
    const credentials = `${accountSid}:${authToken}`;
    const base64Credentials = Buffer.from(credentials).toString('base64');
    headers['Authorization'] = `Basic ${base64Credentials}`;
    console.log('[DownloadService] Authorization header generated correctly.');
  }

  // --- Follow redirects manually to avoid passing Authorization headers to AWS S3 ---
  let currentUrl = url;
  let response;
  let attempts = 0;
  const maxRedirects = 5;

  console.log(`[DownloadService] Beginning download flow for ${url}`);
  
  while (attempts < maxRedirects) {
    // Only include authorization header if requesting a Twilio endpoint
    const parsedUrl = new URL(currentUrl);
    const isTwilioHost = parsedUrl.hostname.endsWith('twilio.com');
    const requestHeaders = isTwilioHost ? { ...headers } : {};

    console.log(`[DownloadService] Requesting: ${currentUrl} (with auth: ${isTwilioHost})`);
    
    response = await fetch(currentUrl, {
      method: 'GET',
      headers: requestHeaders,
      redirect: 'manual'
    });

    console.log(`[DownloadService] Response Status: ${response.status} ${response.statusText}`);

    // If it's a redirect, get the Location header and follow it
    if (response.status >= 300 && response.status < 400) {
      const redirectUrl = response.headers.get('location');
      if (!redirectUrl) {
        throw new Error(`[DownloadService] Redirect status ${response.status} received but no Location header was found.`);
      }
      
      // Resolve redirect url relative to current url
      currentUrl = new URL(redirectUrl, currentUrl).toString();
      console.log(`[DownloadService] Following redirect to: ${currentUrl}`);
      attempts++;
    } else {
      // Not a redirect, we reached the destination
      break;
    }
  }

  // --- Task 5: Log full response body when a non-ok status occurs ---
  if (!response.ok) {
    let errText = '';
    try {
      errText = await response.text();
    } catch (readErr) {
      errText = `(failed to read response text: ${readErr.message})`;
    }
    console.error(`[DownloadService] ERROR: Media retrieval failed with status ${response.status} ${response.statusText}`);
    console.error(`[DownloadService] Twilio Response Body:\n${errText}`);
    throw new Error(`Failed to download media from Twilio. Status: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.promises.writeFile(destPath, buffer);
  
  console.log(`[DownloadService] Media saved successfully to ${destPath}`);
  return destPath;
}

module.exports = {
  downloadMedia
};
