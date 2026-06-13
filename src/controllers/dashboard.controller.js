const ServiceRequest = require('../models/ServiceRequest');
const TripBlock = require('../models/TripBlock');
const Analytics = require('../models/Analytics');

/**
 * Returns dashboard summary overview.
 * GET /api/dashboard/overview
 */
const getOverview = async (req, res, next) => {
  try {
    // 1. Get midnight date of today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 2. Count requests created today
    const requestsToday = await ServiceRequest.countDocuments({
      createdAt: { $gte: startOfToday }
    });

    // 3. Count active TripBlocks (pending dispatch or assigned)
    const activeTripBlocks = await TripBlock.countDocuments({
      status: { $in: ['pending', 'assigned'] }
    });

    // 4. Count requests currently grouped or assigned (part of active loops)
    const groupedRequests = await ServiceRequest.countDocuments({
      status: { $in: ['grouped', 'assigned'] }
    });

    // 5. Count unique assigned providers currently in active trip blocks
    const uniqueProviders = await TripBlock.distinct('providerId', {
      status: 'assigned',
      providerId: { $ne: null }
    });
    const assignedProviders = uniqueProviders.length;

    // 6. Aggregate total savings from analytics
    const savingsResult = await Analytics.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$savings' }
        }
      }
    ]);
    const totalSavings = savingsResult.length > 0 ? Number(savingsResult[0].total.toFixed(2)) : 0;

    res.status(200).json({
      success: true,
      data: {
        requestsToday,
        activeTripBlocks,
        groupedRequests,
        assignedProviders,
        totalSavings
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview
};
