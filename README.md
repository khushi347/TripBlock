# TripBlock AI Service

This is the backend AI service for the hackathon project **TripBlock**. It includes a full audio transcription, parameter extraction, group consolidation, and confirmation pipeline using Node.js, Express, and Gemini.

---

## Architecture

The service is structured into modular service layers in the `services/` directory:

1. **`services/sttService.js`**: Connects to the **Sarvam AI Speech-to-Text API** using native `fetch` and `FormData` to transcribe uploaded files.
2. **`services/geminiService.js`**: Handles structured information extraction using **Gemini 2.5 Flash** with `responseSchema` (structured outputs) to output:
   - `item` (validated strictly to match supported items: `tractor`, `tanker`, `mechanic`, `seeds`, `transport`)
   - `quantity` (defaulting to `1`)
   - `requestedTime` (resolving relative inputs e.g., "kal subah" relative to server time, defaulting to tomorrow at `08:00:00` if missing)
3. **`services/backendService.js`**: Connects to the main **TripBlock Backend API** to submit the logistic requests and group farmers. Currently mocks grouping confirmations.
4. **`services/notificationService.js`**: Sends SMS updates to farmers. Swappable in production with **Twilio SMS**. Currently mocks Hindi SMS confirmations: *"Aapka tractor request confirm ho gaya. Aapke saath 2 aur kisan hain."*

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A Gemini API Key from [Google AI Studio](https://aistudio.google.com/)
- A Sarvam AI API Key from [Sarvam AI Dashboard](https://www.sarvam.ai/)

### Installation

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Open `.env` and fill in your API keys:
   ```env
   PORT=3000
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   SARVAM_API_KEY=your_actual_sarvam_api_key_here
   ```

### Running Locally

To run the development server with automatic file reloading:
```bash
npm run dev
```

To run the server in production mode:
```bash
npm start
```

The service will be available at `http://localhost:3000`.

---

## Testing Instructions

### 1. Automated Integration Tests
We provide an automated integration test script that mocks Gemini responses.

Run it using:
```bash
node test_pipeline.js
```

### 2. Testing with Postman (File Uploads)

You can test both the standalone Speech-to-Text endpoint and the full voice pipeline by uploading files in Postman:

#### Standalone STT `/test-stt`
- **Method**: `POST`
- **URL**: `http://localhost:3000/test-stt`
- **Body Tab**: Select `form-data`
- **Form Data Fields**:
  - **Key**: `file` (hover over the key name, change the type dropdown from `Text` to `File`)
  - **Value**: Select a small `.wav` or `.mp3` recording of spoken voice.
- **Response**: Returns the transcribed text:
  ```json
  {
    "transcript": "Mujhe kal subah tractor chahiye"
  }
  ```

#### Full Pipeline `/voice-request` (Audio Upload -> STT -> Gemini -> Backend -> SMS)
- **Method**: `POST`
- **URL**: `http://localhost:3000/voice-request`
- **Body Tab**: Select `form-data`
- **Form Data Fields**:
  - **Key**: `file` (Type: `File`): Select your audio recording file.
  - **Key**: `phone` (Type: `Text`): `+919876543210`
- **Response**: Returns the transcript, Gemini structured JSON extraction, backend booking status, and notification details:
  ```json
  {
    "transcription": "Mujhe kal subah tractor chahiye",
    "parsedRequest": {
      "item": "tractor",
      "quantity": 1,
      "requestedTime": "2026-06-08T08:00:00"
    },
    "backendResponse": {
      "success": true,
      "grouped": true,
      "tripBlock": {
        "id": "TB001",
        "farmerCount": 3,
        "item": "tractor",
        "status": "open"
      }
    },
    "notification": {
      "sent": true,
      "message": "Aapka tractor request confirm ho gaya. Aapke saath 2 aur kisan hain."
    }
  }
  ```

---

## Manual Testing using `curl`

Make sure your server is running (`npm start` or `npm run dev`) before testing.

#### Health Check
```bash
curl.exe http://localhost:3000/health
# Expected Output: {"status":"ok"}
```

#### Parse Request (Core Gemini Extraction only)
```bash
curl.exe -X POST http://localhost:3000/parse-request \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"Mujhe kal subah tractor chahiye\"}"
```

#### Fallback Manual Entry Request
```bash
curl.exe -X POST http://localhost:3000/fallback-request \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"+919876543210\", \"item\": \"tanker\", \"quantity\": 2}"
```

---

## WhatsApp Integration Layer

This service features a WhatsApp integration layer exposed via a Twilio webhook. 

### Webhook Endpoint `/whatsapp`
- **Method**: `POST`
- **Content-Type**: `application/x-www-form-urlencoded` (Standard Twilio format)
- **Features**:
  - Automatically parses Twilio webhooks using `express.urlencoded({ extended: false })`.
  - Logs the entire Twilio payload.
  - Automatically detects **Text messages**, **Location messages**, and **Voice notes/media attachments**.
  - For Voice Notes/Media:
    - Extracts `MediaUrl0`.
    - Downloads the audio file from Twilio.
    - Saves it temporarily on disk.
    - Passes the saved file to the existing Sarvam + Gemini pipeline.
    - Prints the Original transcript, Parsed JSON, and User phone number to stdout.
    - Deletes the temporary file.
  - Returns a standard XML TwiML response instructing the user: *"Service understood. Please share your current location."*

### Testing the Webhook Locally
We provide a mock-based automated integration test script to verify the webhook:
```bash
node test_whatsapp.js
```

### Run Instructions (Ngrok + Twilio Sandbox)

Follow these steps to test WhatsApp voice notes/media live:

1. **Expose the Local Port using ngrok**:
   Start ngrok on the server port (usually `3000`):
   ```bash
   ngrok http 3000
   ```
   Copy the secure HTTPS URL generated (e.g., `https://xxxx-xx-xx-xx.ngrok-free.app`).

2. **Configure Twilio WhatsApp Sandbox**:
   - Go to your Twilio Console -> **Messaging** -> **Try it Out** -> **Send a WhatsApp Message**.
   - Send the activation message (e.g., `join sandbox-word`) from your phone to the Twilio Sandbox WhatsApp number.
   - Go to **Sandbox settings**.
   - Under **"When a message comes in"**, set the URL to:
     ```
     https://xxxx-xx-xx-xx.ngrok-free.app/whatsapp
     ```
   - Make sure the HTTP Method is set to **`POST`**.
   - Save the settings.

3. **Start the Application**:
   ```bash
   npm run dev
   ```

4. **Send a WhatsApp Message**:
   - Send a **voice note**, a **text message**, or a **location pin** to the Twilio WhatsApp Sandbox number.
   - Monitor the console logs to see the payloads printed and the voice note processing.

