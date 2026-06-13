const ServiceRequest = require('../models/ServiceRequest');
const TripBlock = require('../models/TripBlock');
const { getDistance } = require('../utils/geo');
const savingsService = require('./savings.service');
const socketService = require('./socket.service');

/**
 * Parses requestedDate and requestedTime into a local Date object.
 * @param {object} req ServiceRequest model instance/object
 * @returns {Date}
 */
const getRequestDateTime = (req) => {
  return new Date(`${req.requestedDate}T${req.requestedTime}:00`);
};

/**
 * Triggers geospatial and temporal matching logic to group pending requests.
 * @param {object} newRequest The newly created ServiceRequest
 * @returns {Promise<object|null>} The populated TripBlock if created, otherwise null
 */
const triggerGrouping = async (newRequest) => {
  try {
    // 1. Find other pending requests of the same type within 5km
    const matchingRequests = await ServiceRequest.find({
      _id: { $ne: newRequest._id },
      status: 'pending',
      serviceType: newRequest.serviceType,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: newRequest.location.coordinates
          },
          $maxDistance: 5000 // 5 KM in meters
        }
      }
    });

    // 2. Filter requests by temporal proximity (±2 hours)
    const newReqTime = getRequestDateTime(newRequest).getTime();
    const temporalMatches = matchingRequests.filter(req => {
      const reqTime = getRequestDateTime(req).getTime();
      return Math.abs(newReqTime - reqTime) <= 2 * 60 * 60 * 1000; // 2 hours in ms
    });

    // 3. Check if we have enough requests to group (minimum 2 total: newRequest + at least 1 match)
    if (temporalMatches.length === 0) {
      console.log(`No matching pending requests found for request ${newRequest._id} to form a TripBlock.`);
      return null;
    }

    const allRequests = [newRequest, ...temporalMatches];
    const groupedIds = allRequests.map(r => r._id);

    // 4. Calculate maximum distance between requests (radius covered)
    let maxDist = 0;
    const coords = allRequests.map(r => r.location.coordinates);
    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const dist = getDistance(coords[i], coords[j]);
        if (dist > maxDist) maxDist = dist;
      }
    }

    // 5. Calculate savings
    const individualCosts = allRequests.map(r => r.individualCost);
    const quantities = allRequests.map(r => r.quantity);
    const estimatedSharedCost = savingsService.estimateSharedCost(newRequest.serviceType, quantities);
    const estimatedSavings = savingsService.calculateSavings(individualCosts, estimatedSharedCost);

    // 6. Create TripBlock
    const tripBlock = new TripBlock({
      serviceType: newRequest.serviceType,
      groupedRequests: groupedIds,
      radiusCovered: maxDist,
      estimatedSavings: estimatedSavings,
      status: 'pending'
    });
    await tripBlock.save();

    // 7. Update status of all grouped requests
    await ServiceRequest.updateMany(
      { _id: { $in: groupedIds } },
      { $set: { status: 'grouped', tripBlockId: tripBlock._id } }
    );

    // Populate requests for response/sockets
    const populatedBlock = await TripBlock.findById(tripBlock._id).populate({
      path: 'groupedRequests',
      populate: { path: 'farmerId', select: 'name phone' }
    });

    // 8. Emit socket event
    socketService.emitEvent('tripblock_created', populatedBlock);

    console.log(`Successfully created TripBlock ${tripBlock._id} with ${allRequests.length} requests. Savings: ${estimatedSavings}`);
    return populatedBlock;
  } catch (error) {
    console.error('Error in Grouping Engine:', error);
    throw error;
  }
};

module.exports = {
  triggerGrouping
};
