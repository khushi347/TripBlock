/**
 * Backend Service.
 * 
 * In production, this will communicate with the main TripBlock backend API to save the requests
 * and perform grouping logic.
 */
class BackendService {
  /**
   * Submits parsed request data to the backend.
   * @param {object} params
   * @param {string} params.phone - Farmer's phone number
   * @param {string} params.item - The type of item requested
   * @param {number} params.quantity - Quantity requested
   * @param {string} params.requestedTime - Extracted requested ISO time
   * @returns {Promise<object>} Backend response including success status and group details
   */
  async submitRequest({ phone, item, quantity, requestedTime, location }) {
    // Production integration example:
    // -------------------------------------------------------------
    // const axios = require('axios');
    // const response = await axios.post(`${process.env.BACKEND_API_URL}/api/requests`, {
    //   phone,
    //   item,
    //   quantity,
    //   requestedTime,
    //   location
    // });
    // return response.data;
    // -------------------------------------------------------------

    // Mock implementation for hackathon:
    console.log('[BackendService] Submitting request to backend:', { phone, item, quantity, requestedTime, location });
    
    return {
      success: true,
      grouped: true,
      tripBlock: {
        id: 'TB001',
        farmerCount: 3,
        item: item || 'tractor',
        status: 'open'
      }
    };
  }
}

module.exports = new BackendService();
