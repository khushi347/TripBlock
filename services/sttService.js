const fs = require('fs');

const model = 'saarika:v2.5';
console.log("[SttService] Selected model:", model);

/**
 * Speech-to-Text (STT) Service.
 * Connects to the Sarvam AI STT API to transcribe audio files.
 */
class SttService {
  /**
   * Transcribes a local audio file to text using Sarvam AI Speech-to-Text API.
   * @param {string} audioPath - Path to the local audio file (e.g. .wav)
   * @returns {Promise<string>} Transcribed text
   */
  async transcribe(audioPath) {
    if (!audioPath) {
      throw new Error('sttService.transcribe: audioPath is required');
    }

    if (!fs.existsSync(audioPath)) {
      throw new Error(`sttService.transcribe: Audio file not found at path: ${audioPath}`);
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      throw new Error('SARVAM_API_KEY environment variable is not set.');
    }

    console.log(`[SttService] Uploading and transcribing ${audioPath} via Sarvam API...`);
    console.log('[SttService] Selected model:', model);

    // Create form data using Node's global FormData
    const formData = new FormData();
    
    // Read the file as a buffer, and wrap it in a Blob
    const fileBuffer = fs.readFileSync(audioPath);
    const blob = new Blob([fileBuffer], { type: 'audio/wav' });
    
    formData.append('file', blob, 'audio.wav');
    formData.append('model', model);

    try {
      const response = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: {
          'api-subscription-key': apiKey
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sarvam STT API failed with status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (!result || typeof result.transcript !== 'string') {
        throw new Error(`Invalid response structure from Sarvam STT API: ${JSON.stringify(result)}`);
      }

      console.log(`[SttService] Transcript result: "${result.transcript}"`);
      return result.transcript;

    } catch (error) {
      console.error('Error in SttService.transcribe:', error);
      throw error;
    }
  }
}

module.exports = new SttService();
