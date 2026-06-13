/**
 * AI Provider Recommendation Engine Service (Deterministic)
 * 
 * Recommends the best provider for a trip block using multiple factors:
 * 1. Distance from trip block (30%)
 * 2. Availability (20%)
 * 3. Capacity match (30%)
 * 4. Rating (10%)
 * 5. Completed jobs (10%)
 */

// Helper to calculate Haversine distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return Infinity;
  }
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class RecommendationService {
  /**
   * Recommend the best provider for a Trip Block.
   * @param {object} tripBlock 
   * @param {array} providers 
   * @returns {object} The recommendation result or fallback
   */
  recommendProvider(tripBlock, providers) {
    if (!tripBlock || !Array.isArray(providers) || providers.length === 0) {
      return {
        status: "no_provider_found",
        message: "कोई उपयुक्त प्रदाता उपलब्ध नहीं है।"
      };
    }

    const requiredCapacity = tripBlock.requiredCapacity || 0;
    const blockService = tripBlock.service;
    const blockLocation = tripBlock.location || {};

    // 1. Filter providers based on constraints:
    // - Same service type
    // - Available === true
    // - Capacity >= required capacity
    const qualifiedProviders = providers.filter(provider => {
      // Standardize service string comparison (e.g. tanker vs water_tanker)
      const serviceMatches = this.normalizeService(provider.service) === this.normalizeService(blockService);
      const isAvailable = provider.available === true;
      const hasSufficientCapacity = (provider.capacity || 0) >= requiredCapacity;

      return serviceMatches && isAvailable && hasSufficientCapacity;
    });

    if (qualifiedProviders.length === 0) {
      return {
        status: "no_provider_found",
        message: "कोई उपयुक्त प्रदाता उपलब्ध नहीं है।"
      };
    }

    // 2. Score and Rank providers
    const scoredProviders = qualifiedProviders.map(provider => {
      // Distance calculation
      const providerLocation = provider.location || {};
      const distance = calculateDistance(
        blockLocation.lat,
        blockLocation.lng,
        providerLocation.lat,
        providerLocation.lng
      );

      // Distance Score: Decay linearly to 0.0 at 50 km or more
      const distanceScore = distance === Infinity ? 0.0 : Math.max(0, 1 - distance / 50);

      // Capacity Score: 1.0 for perfect match, decays as capacity increases
      const capacityScore = provider.capacity ? (requiredCapacity / provider.capacity) : 1.0;

      // Availability Score: always 1.0 for qualified (since they are filtered to available = true)
      const availabilityScore = provider.available ? 1.0 : 0.0;

      // Rating Score: normalized to 0.0 - 1.0 (rating / 5)
      const ratingScore = provider.rating ? (provider.rating / 5.0) : 0.0;

      // Completed Jobs Score: saturates at 100+ jobs
      const completedJobsScore = provider.completedJobs ? Math.min(1.0, provider.completedJobs / 100) : 0.0;

      // Calculate overall score (0.0 to 1.0 scale)
      const totalScore = (
        distanceScore * 0.30 +
        capacityScore * 0.30 +
        availabilityScore * 0.20 +
        ratingScore * 0.10 +
        completedJobsScore * 0.10
      );

      const matchScore = Math.round(totalScore * 100);

      return {
        provider,
        score: matchScore,
        details: {
          distance,
          distanceScore,
          capacityScore,
          availabilityScore,
          ratingScore,
          completedJobsScore
        }
      };
    });

    // Sort descending by score, and break ties with completedJobs then rating
    scoredProviders.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const aJobs = a.provider.completedJobs || 0;
      const bJobs = b.provider.completedJobs || 0;
      if (bJobs !== aJobs) {
        return bJobs - aJobs;
      }
      const aRating = a.provider.rating || 0;
      const bRating = b.provider.rating || 0;
      return bRating - aRating;
    });

    const best = scoredProviders[0];

    // Generate explanations dynamically
    const { reasons, reasonsHindi } = this.generateExplanations(tripBlock, best.provider, best.details);

    // Build the rankings array format: [ { provider: name, score: matchScore } ]
    const rankings = scoredProviders.map(p => ({
      provider: p.provider.name,
      score: p.score
    }));

    return {
      recommendedProvider: best.provider.name,
      recommendedProviderDetails: best.provider, // Included details object for richness
      matchScore: best.score,
      reasons,
      reasonsHindi,
      rankings
    };
  }

  /**
   * Helper to normalize service names.
   * Handles conversions like "water_tanker" <-> "tanker".
   */
  normalizeService(service) {
    if (!service) return "";
    const s = service.toLowerCase().trim().replace(/_/g, " ");
    if (s === "water tanker") return "tanker";
    if (s === "seed supplier") return "seeds";
    return s;
  }

  /**
   * Generates English and Hindi explanation reasons based on scoring details.
   */
  generateExplanations(tripBlock, provider, details) {
    const reasons = [];
    const reasonsHindi = [];

    // Capacity check
    if (provider.capacity >= (tripBlock.requiredCapacity || 0)) {
      reasons.push("Capacity matches requirement");
      reasonsHindi.push("पर्याप्त क्षमता उपलब्ध है");
    }

    // Availability check
    if (provider.available) {
      reasons.push("Provider is available");
      reasonsHindi.push("प्रदाता उपलब्ध है");
    }

    // Rating check
    if (provider.rating >= 4.5) {
      reasons.push("High customer rating");
      reasonsHindi.push("उच्च रेटिंग");
    } else if (provider.rating >= 3.5) {
      reasons.push("Good customer rating");
      reasonsHindi.push("अच्छी रेटिंग");
    }

    // Distance check
    if (details.distance <= 5) {
      reasons.push("Located near trip block");
      reasonsHindi.push("निकट दूरी");
    } else if (details.distance <= 15) {
      reasons.push("Reasonable distance from trip block");
      reasonsHindi.push("मध्यम दूरी");
    }

    // Completed jobs/experience check
    if (provider.completedJobs >= 100) {
      reasons.push("Highly experienced provider");
      reasonsHindi.push("अनुभवी प्रदाता");
    } else if (provider.completedJobs >= 30) {
      reasons.push("Experienced provider");
      reasonsHindi.push("अनुभव है");
    }

    return { reasons, reasonsHindi };
  }
}

module.exports = new RecommendationService();
