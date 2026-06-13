const Provider = require('../models/Provider');
const { getDistance, getCentroid } = require('../utils/geo');

/**
 * Recommends and ranks active providers for a given TripBlock.
 * @param {object} tripBlock Populated TripBlock instance containing groupedRequests
 * @param {number} [maxRadius=15000] Maximum search radius in meters (default 15km)
 * @returns {Promise<Array<object>>} Ranked list of provider recommendations with scoring breakdown
 */
const recommendProviders = async (tripBlock, maxRadius = 15000) => {
  try {
    if (!tripBlock.groupedRequests || tripBlock.groupedRequests.length === 0) {
      throw new Error('TripBlock has no grouped requests.');
    }

    // 1. Calculate centroid of all request locations in the TripBlock
    const coords = tripBlock.groupedRequests.map(req => req.location.coordinates);
    const centroid = getCentroid(coords);

    // 2. Query active providers of the matching service type within the max radius
    const providers = await Provider.find({
      serviceType: tripBlock.serviceType,
      status: 'active',
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: centroid
          },
          $maxDistance: maxRadius
        }
      }
    });

    // 3. Calculate total required capacity for this TripBlock
    const totalQuantity = tripBlock.groupedRequests.reduce((sum, req) => sum + req.quantity, 0);

    // 4. Calculate recommendation score for each provider
    const recommendations = providers.map(provider => {
      const distance = getDistance(provider.location.coordinates, centroid);

      // Normalize scores between 0 and 1
      const distanceScore = distance <= 1000 ? 1.0 : Math.max(0, 1 - (distance / maxRadius));
      const ratingScore = (provider.rating || 5.0) / 5.0;
      const availabilityScore = provider.availability ? 1.0 : 0.0;
      
      // Capacity match score: 1.0 if capacity meets/exceeds requirement, else ratio
      const capacityScore = provider.capacity >= totalQuantity ? 1.0 : (provider.capacity / totalQuantity);
      const completionScore = provider.completionRate !== undefined ? provider.completionRate : 1.0;

      // Weight breakdown:
      // Distance (30%), Rating (25%), Availability (20%), Capacity (15%), Completion (10%)
      const score = (0.30 * distanceScore) +
                    (0.25 * ratingScore) +
                    (0.20 * availabilityScore) +
                    (0.15 * capacityScore) +
                    (0.10 * completionScore);

      return {
        provider: {
          _id: provider._id,
          name: provider.name,
          phone: provider.phone,
          email: provider.email,
          serviceType: provider.serviceType,
          capacity: provider.capacity,
          availability: provider.availability,
          rating: provider.rating,
          completionRate: provider.completionRate,
          costPerTrip: provider.costPerTrip
        },
        distance: Number(distance.toFixed(1)), // meters
        scoreBreakdown: {
          distanceScore: Number(distanceScore.toFixed(3)),
          ratingScore: Number(ratingScore.toFixed(3)),
          availabilityScore: Number(availabilityScore.toFixed(3)),
          capacityScore: Number(capacityScore.toFixed(3)),
          completionScore: Number(completionScore.toFixed(3))
        },
        score: Number(score.toFixed(4))
      };
    });

    // 5. Sort recommendations in descending order of score
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations;
  } catch (error) {
    console.error('Error in Provider Matching Engine:', error);
    throw error;
  }
};

module.exports = {
  recommendProviders
};
