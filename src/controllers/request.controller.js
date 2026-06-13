const ServiceRequest = require('../models/ServiceRequest');
const groupingService = require('../services/grouping.service');
const savingsService = require('../services/savings.service');
const socketService = require('../services/socket.service');

/**
 * Create a new service request and immediately run grouping analysis.
 * POST /api/requests
 */
const createRequest = async (req, res, next) => {
  try {
    const { farmerId, serviceType, quantity, requestedDate, requestedTime, location } = req.body;

    // Determine farmerId from body or from authenticated session
    const resolvedFarmerId = farmerId || (req.user ? req.user._id : null);
    if (!resolvedFarmerId) {
      res.status(400);
      throw new Error('Farmer ID must be provided either in the payload or via authentication.');
    }

    // 1. Calculate individual cost using savings engine
    const individualCost = savingsService.calculateIndividualCost(serviceType, quantity);

    // 2. Create and store request
    const request = new ServiceRequest({
      farmerId: resolvedFarmerId,
      serviceType,
      quantity,
      requestedDate,
      requestedTime,
      location,
      individualCost,
      status: 'pending'
    });

    await request.save();

    // Populate farmer info for socket notifications
    const populatedRequest = await ServiceRequest.findById(request._id).populate('farmerId', 'name phone');

    // 3. Emit real-time event
    socketService.emitEvent('request_created', populatedRequest);

    // 4. Immediately trigger Grouping Engine
    const tripBlock = await groupingService.triggerGrouping(populatedRequest);

    res.status(201).json({
      success: true,
      data: {
        request: populatedRequest,
        grouped: !!tripBlock,
        tripBlock: tripBlock
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve all service requests with optional filters.
 * GET /api/requests
 */
const getRequests = async (req, res, next) => {
  try {
    const { status, serviceType, farmerId } = req.query;
    const query = {};

    if (status) query.status = status;
    if (serviceType) query.serviceType = serviceType;
    if (farmerId) query.farmerId = farmerId;

    const requests = await ServiceRequest.find(query)
      .populate('farmerId', 'name phone email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRequest,
  getRequests
};
