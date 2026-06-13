const Analytics = require('../models/Analytics');
const ServiceRequest = require('../models/ServiceRequest');

/**
 * Get savings over time.
 * GET /api/analytics/savings
 */
const getSavings = async (req, res, next) => {
  try {
    const savingsData = await Analytics.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
          savings: { $sum: '$savings' },
          tripsCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const formattedData = savingsData.map(item => ({
      date: item._id,
      savings: Number(item.savings.toFixed(2)),
      tripsCount: item.tripsCount
    }));

    res.status(200).json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get demand hotspots (geospatial coordinates grouped by proximity).
 * GET /api/analytics/demand-hotspots
 */
const getDemandHotspots = async (req, res, next) => {
  try {
    const hotspots = await ServiceRequest.aggregate([
      {
        $group: {
          _id: {
            coordinates: '$location.coordinates'
          },
          requestCount: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      { $sort: { requestCount: -1 } }
    ]);

    const formattedHotspots = hotspots.map(item => ({
      location: {
        type: 'Point',
        coordinates: item._id.coordinates
      },
      requestCount: item.requestCount,
      totalQuantity: item.totalQuantity
    }));

    res.status(200).json({
      success: true,
      count: formattedHotspots.length,
      data: formattedHotspots
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get request count grouped by serviceType.
 * GET /api/analytics/service-distribution
 */
const getServiceDistribution = async (req, res, next) => {
  try {
    const distribution = await ServiceRequest.aggregate([
      {
        $group: {
          _id: '$serviceType',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const formattedDistribution = distribution.map(item => ({
      serviceType: item._id,
      count: item.count,
      totalQuantity: item.totalQuantity
    }));

    res.status(200).json({
      success: true,
      data: formattedDistribution
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get coverage of different villages/locations.
 * GET /api/analytics/village-coverage
 */
const getVillageCoverage = async (req, res, next) => {
  try {
    const coverage = await ServiceRequest.aggregate([
      {
        $group: {
          _id: '$location.coordinates',
          requestsAtLocation: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUniquePoints: coverage.length,
        locations: coverage.map(item => ({
          coordinates: item._id,
          requestCount: item.requestsAtLocation
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSavings,
  getDemandHotspots,
  getServiceDistribution,
  getVillageCoverage
};
