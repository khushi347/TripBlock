const serviceRates = {
  water_tanker: { base: 50, perUnit: 0.15 }, // per liter
  tractor: { base: 100, perUnit: 10 },       // per hour
  harvester: { base: 200, perUnit: 25 },     // per acre
  default: { base: 50, perUnit: 1.0 }
};

/**
 * Calculates individual service cost based on service type and quantity.
 * @param {string} serviceType 
 * @param {number} quantity 
 * @returns {number}
 */
const calculateIndividualCost = (serviceType, quantity) => {
  const rates = serviceRates[serviceType.toLowerCase()] || serviceRates.default;
  return Number((rates.base + (rates.perUnit * quantity)).toFixed(2));
};

/**
 * Estimates the shared cost of a trip before provider assignment.
 * Applies a sliding scale discount based on group size (bulk discount / shared transport efficiency).
 * @param {string} serviceType 
 * @param {number[]} quantities Array of quantities of grouped requests
 * @returns {number}
 */
const estimateSharedCost = (serviceType, quantities) => {
  const totalQuantity = quantities.reduce((sum, q) => sum + q, 0);
  const rates = serviceRates[serviceType.toLowerCase()] || serviceRates.default;
  const numRequests = quantities.length;
  
  // Larger groups get larger discount factors due to routing/dispatch optimization
  let discountFactor = 1.0;
  if (numRequests === 2) discountFactor = 0.80;
  else if (numRequests === 3) discountFactor = 0.70;
  else if (numRequests >= 4) discountFactor = 0.60;

  const rawShared = rates.base + (rates.perUnit * totalQuantity);
  return Number((rawShared * discountFactor).toFixed(2));
};

/**
 * Calculates net savings.
 * @param {number[]} individualCosts 
 * @param {number} sharedCost 
 * @returns {number}
 */
const calculateSavings = (individualCosts, sharedCost) => {
  const totalIndividual = individualCosts.reduce((sum, cost) => sum + cost, 0);
  const savings = totalIndividual - sharedCost;
  return Number(Math.max(0, savings).toFixed(2));
};

module.exports = {
  calculateIndividualCost,
  estimateSharedCost,
  calculateSavings,
  serviceRates
};
