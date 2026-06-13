const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

// Check that API key is set, though we will handle missing keys gracefully in the controller
const getApiKey = () => {
  return process.env.GEMINI_API_KEY;
};

/**
 * Service to interact with Gemini API for parsing user requests.
 */
class GeminiService {
  constructor() {
    this.apiKey = getApiKey();
    this.genAI = null;
    this.model = null;
    this.followUpModel = null;

    if (this.apiKey) {
      this.initModels();
    }
  }

  initModels() {
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    
    // Main request parsing model
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            service: {
              type: SchemaType.STRING,
              description: 'The service being requested. Must be one of: tractor, tanker, transport, mechanic, seeds, labour, pesticide sprayer.',
            },
            landArea: {
              type: SchemaType.STRING,
              description: 'Land area requested for tractor (e.g. "3 acre", "5 bigha"). Only extract if service is tractor.',
            },
            requestedTime: {
              type: SchemaType.STRING,
              description: 'The target date and time in YYYY-MM-DDTHH:mm:ss format. Calculate relative dates based on the current reference time.',
            },
            quantity: {
              type: SchemaType.STRING,
              description: 'Quantity requested (e.g. "2000 litres" for water tanker, "50 kg" for seeds).',
            },
            destination: {
              type: SchemaType.STRING,
              description: 'Destination for transport service.',
            },
            issueDescription: {
              type: SchemaType.STRING,
              description: 'Detailed description of the issue for the mechanic service.',
            },
            cropType: {
              type: SchemaType.STRING,
              description: 'Type of crop for seeds or pesticide sprayer.',
            },
            numberOfWorkers: {
              type: SchemaType.STRING,
              description: 'Number of workers requested for labour service.',
            },
            farmArea: {
              type: SchemaType.STRING,
              description: 'Farm area for pesticide sprayer.',
            },
            location: {
              type: SchemaType.STRING,
              description: 'The location (village, town, or city name) where the service is requested.',
            },
            confidence: {
              type: SchemaType.NUMBER,
              description: 'Confidence score of the extraction between 0.0 and 1.0 (e.g., 0.95).'
            }
          },
          required: ['service', 'confidence']
        }
      }
    });

    // Follow-up field-specific parsing model
    this.followUpModel = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            extractedValue: {
              type: SchemaType.STRING,
              description: 'The extracted value for the field we are waiting for.'
            },
            confidence: {
              type: SchemaType.NUMBER,
              description: 'Confidence score of this specific extraction between 0.0 and 1.0.'
            }
          },
          required: ['extractedValue', 'confidence']
        }
      }
    });
  }

  /**
   * Helper to format a date to YYYY-MM-DDTHH:mm:ss local time representation
   * @param {Date} date 
   * @returns {string}
   */
  formatDateTime(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  /**
   * Parses the request text using Gemini 2.5 Flash.
   * @param {string} text - The input text from user (e.g. "Mujhe kal subah tractor chahiye")
   * @returns {Promise<object>} The validated and formatted JSON response
   */
  async parseRequest(text) {
    if (!this.apiKey) {
      this.apiKey = getApiKey();
      if (!this.apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set.');
      }
      this.initModels();
    }

    const now = new Date();
    const currentDateTimeISO = this.formatDateTime(now);

    const prompt = `
You are an AI assistant parsing logistics and supply requests for the hackathon project TripBlock.
Analyze the following request text and extract the service type and any specific field values.

Supported services are exactly:
- tractor (Tractor service)
- tanker (Water Tanker service)
- transport (Transport service)
- mechanic (Mechanic service)
- seeds (Seed Supplier service)
- labour (Labour service)
- pesticide sprayer (Pesticide Sprayer service)

Current date and time context (Reference point for relative dates like "tomorrow", "kal", "next week", "subah", "sham"):
${currentDateTimeISO}

Instructions:
1. Translate and interpret terms in Hinglish/Hindi or English (e.g., "tractor chahiye" means "tractor" is the service).
2. Map terms like "paani ka tanker" or "water tanker" to "tanker", "beej" or "seed supplier" to "seeds", "mazdoor" or "workers" to "labour", "spray" or "dawai chhidakna" to "pesticide sprayer".
3. Extract specific fields based on service type if explicitly mentioned. For example, if they mention "3 acre" and it's a tractor request, extract "3 acre" to landArea.
4. Extract the requested time and resolve relative terms (e.g. "kal subah" -> tomorrow morning 08:00, "kal shaam" -> tomorrow evening 18:00, "parso" -> day after tomorrow) relative to the current reference time: ${currentDateTimeISO}. Format the result as YYYY-MM-DDTHH:mm:ss.
5. Extract any location information (like village, town, or city name) if explicitly mentioned in the request text and populate the location field.
6. Provide a confidence score between 0.0 and 1.0 based on how clear the request is.

User Request Text: "${text}"
`;

    let result;
    let attempts = 0;
    const maxRetries = 3;

    while (true) {
      try {
        result = await this.model.generateContent(prompt);
        break;
      } catch (error) {
        attempts++;
        if (attempts > maxRetries) {
          console.error(`[GeminiService] Call failed after ${attempts} attempts.`);
          throw error;
        }
        console.warn(`[GeminiService] Attempt ${attempts} failed. Retrying in 2 seconds... Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    try {
      const responseText = result.response.text();
      
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(`Failed to parse Gemini response: ${responseText}`);
      }

      // --- Strict Validation and Defaults ---
      const supportedServices = ['tractor', 'tanker', 'transport', 'mechanic', 'seeds', 'labour', 'pesticide sprayer'];
      
      let service = parsed.service ? parsed.service.toLowerCase().trim() : null;
      // Normalization check
      if (service === 'water tanker') service = 'tanker';
      if (service === 'seed supplier') service = 'seeds';
      if (service === 'labor') service = 'labour';

      if (!service || !supportedServices.includes(service)) {
        // Double check if the input text contains the words directly to rescue minor parsing mistakes
        const foundService = supportedServices.find(s => text.toLowerCase().includes(s));
        if (foundService) {
          service = foundService;
        } else if (text.toLowerCase().includes('paani') || text.toLowerCase().includes('tanker')) {
          service = 'tanker';
        } else if (text.toLowerCase().includes('beej') || text.toLowerCase().includes('seed')) {
          service = 'seeds';
        } else if (text.toLowerCase().includes('mazdoor') || text.toLowerCase().includes('worker')) {
          service = 'labour';
        } else if (text.toLowerCase().includes('spray') || text.toLowerCase().includes('sprayer') || text.toLowerCase().includes('chhidakna')) {
          service = 'pesticide sprayer';
        } else {
          throw new Error(`Invalid or unsupported item. Got "${parsed.service || 'none'}". Supported items: ${supportedServices.join(', ')}`);
        }
      }

      // If requestedTime is in the response and is valid, keep it; otherwise leave as null or let the system default it
      let requestedTime = parsed.requestedTime;
      if (requestedTime && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(requestedTime)) {
        requestedTime = null;
      }

      return {
        service,
        item: service, // for backward compatibility
        confidence: parsed.confidence || 0.85,
        landArea: parsed.landArea || null,
        requestedTime,
        quantity: parsed.quantity || null,
        destination: parsed.destination || null,
        issueDescription: parsed.issueDescription || null,
        cropType: parsed.cropType || null,
        numberOfWorkers: parsed.numberOfWorkers || null,
        farmArea: parsed.farmArea || null,
        location: parsed.location || null
      };

    } catch (error) {
      console.error('Error in GeminiService.parseRequest:', error);
      throw error;
    }
  }

  /**
   * Fallback method using Gemini to parse a specific field response when heuristics fail.
   * @param {string} text - User message (e.g. "3 acre")
   * @param {string} service - e.g. "tractor"
   * @param {string} waitingFor - e.g. "landArea"
   * @returns {Promise<object>} { extractedValue, confidence }
   */
  async parseFollowUp(text, service, waitingFor) {
    if (!this.apiKey) {
      this.apiKey = getApiKey();
      if (!this.apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set.');
      }
      this.initModels();
    }

    const prompt = `
The user has an ongoing request for the service: "${service}".
We asked them a follow-up question to obtain the value for the field: "${waitingFor}".
User response: "${text}"

Please extract the value for the field "${waitingFor}" from the user response.
If the response is short or is direct (e.g. "3 acre", "Delhi", "5 workers"), extract that as the value.
If the user's response is in Hindi/Hinglish (e.g., "teen", "parso"), extract the meaning and format/translate it nicely to English or numeric values as appropriate.
Calculate relative dates (like "kal", "parso") and format them as YYYY-MM-DDTHH:mm:ss if waitingFor is requestedTime.
If waitingFor is location, extract the village, town, or city name as is, keeping it in Hindi/Hinglish if that is what the user typed.

Return the result as a JSON object with:
- "extractedValue": the parsed value
- "confidence": confidence score between 0.0 and 1.0
`;

    let result;
    try {
      result = await this.followUpModel.generateContent(prompt);
      const responseText = result.response.text();
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Error in GeminiService.parseFollowUp:', error);
      return {
        extractedValue: text,
        confidence: 0.5
      };
    }
  }
}

module.exports = new GeminiService();
