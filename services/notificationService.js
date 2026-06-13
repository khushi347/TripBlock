/**
 * Notification Service.
 * 
 * In production, this can be integrated with Twilio SMS API.
 */
class NotificationService {
  /**
   * Sends a generic notification message.
   * @param {string} phone - Recipient phone number
   * @param {string} message - SMS content
   * @returns {Promise<object>} Sending status
   */
  async sendNotification(phone, message) {
    // Production integration example with Twilio:
    // -------------------------------------------------------------
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // 
    // const response = await client.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phone
    // });
    // return { sent: true, messageId: response.sid };
    // -------------------------------------------------------------

    // Mock implementation for hackathon:
    console.log(`[NotificationService] Sending SMS to ${phone || 'unknown'}: "${message}"`);
    
    return {
      sent: true,
      message
    };
  }

  /**
   * Generates and sends a localized Hindi confirmation notification.
   * @param {object} params
   * @param {string} params.phone - Farmer's phone number
   * @param {string} params.item - The requested item
   * @param {number} params.farmerCount - Total farmer count in the matched group
   * @returns {Promise<object>} Sending status containing the message content
   */
  async sendConfirmation({ phone, item, farmerCount }) {
    const othersCount = Math.max(0, farmerCount - 1);
    
    const map = {
      tractor: 'ट्रैक्टर',
      tanker: 'वाटर टैंकर',
      transport: 'परिवहन',
      mechanic: 'मैकेनिक',
      seeds: 'बीज',
      labour: 'मजदूर',
      'pesticide sprayer': 'कीटनाशक स्प्रेयर'
    };
    const itemHindi = map[item] || item;
    const confirmationMessage = `आपका ${itemHindi || 'ट्रैक्टर'} का अनुरोध कन्फर्म हो गया है। आपके साथ ${othersCount} और किसान हैं।`;
    
    return this.sendNotification(phone, confirmationMessage);
  }
}

module.exports = new NotificationService();
