import { API_CONFIG } from '../modules/utils/config.js';

/**
 * Service for checking product availability and delivery periods via API
 */
export class AvailabilityService {
  /**
   * Fetches the estimated delivery period for a specific product and quantity
   * @param {string|number} productId - The article/SKU of the product
   * @param {number} quantity - Desired quantity
   * @returns {Promise<number|string>} - Returns number of days or a message if unavailable
   */
  async getAvailabilityPeriod(productId, quantity) {
    const url =
      'https://keaz.ru/restapi/catalog/service/availability_calculation_period.json';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Hash: API_CONFIG.HASH,
        },
        body: JSON.stringify({
          warehouse_id: 2,
          product_id: productId,
          quantity: parseInt(quantity, 10) || 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // According to requirements: return period[0].days
      if (
        data &&
        data.period &&
        Array.isArray(data.period) &&
        data.period.length > 0
      ) {
        const result = data.period[0].days;
        return result;
      }

      return 'Нет срока';
    } catch (error) {
      console.error('AvailabilityService Error:', error);
      throw error;
    }
  }
}
