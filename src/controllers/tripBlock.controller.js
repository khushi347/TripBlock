const TripBlock = require('../models/TripBlock');
const matchingService = require('../services/matching.service');

/**
 * Get all TripBlocks with optional filters.
 * GET /api/tripblocks
 */
const getTripBlocks = async (req, res, next) => {
  try {
    const { status, serviceType } = req.query;
    const query = {};

    if (status) query.status = status;
    if (serviceType) query.serviceType = serviceType;

    const tripBlocks = await TripBlock.find(query)
      .populate({
        path: 'groupedRequests',
        populate: { path: 'farmerId', select: 'name phone email' }
      })
      .populate('providerId', 'name phone email status')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tripBlocks.length,
      data: tripBlocks
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get TripBlock details by ID.
 * GET /api/tripblocks/:id
 */
const getTripBlockById = async (req, res, next) => {
  try {
    const tripBlock = await TripBlock.findById(req.params.id)
      .populate({
        path: 'groupedRequests',
        populate: { path: 'farmerId', select: 'name phone email' }
      })
      .populate('providerId', 'name phone email status');

    if (!tripBlock) {
      res.status(404);
      throw new Error('TripBlock not found');
    }

    res.status(200).json({
      success: true,
      data: tripBlock
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recommended providers for a TripBlock.
 * GET /api/tripblocks/:id/recommend-providers
 */
const getRecommendations = async (req, res, next) => {
  try {
    const tripBlock = await TripBlock.findById(req.params.id).populate('groupedRequests');

    if (!tripBlock) {
      res.status(404);
      throw new Error('TripBlock not found');
    }

    const maxRadius = req.query.radius ? parseInt(req.query.radius) : 15000; // in meters (default 15km)
    const recommendations = await matchingService.recommendProviders(tripBlock, maxRadius);

    res.status(200).json({
      success: true,
      count: recommendations.length,
      data: recommendations
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTripBlocks,
  getTripBlockById,
  getRecommendations
};
