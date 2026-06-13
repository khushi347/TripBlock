const Assignment = require('../models/Assignment');
const TripBlock = require('../models/TripBlock');
const Provider = require('../models/Provider');
const ServiceRequest = require('../models/ServiceRequest');
const Analytics = require('../models/Analytics');
const savingsService = require('../services/savings.service');
const socketService = require('../services/socket.service');
const { getCentroid } = require('../utils/geo');

/**
 * Assign a provider to a TripBlock.
 * POST /api/assignments
 */
const createAssignment = async (req, res, next) => {
  try {
    const { tripBlockId, providerId } = req.body;

    // 1. Validate TripBlock and Provider
    const tripBlock = await TripBlock.findById(tripBlockId);
    if (!tripBlock) {
      res.status(404);
      throw new Error('TripBlock not found');
    }
    if (tripBlock.status !== 'pending') {
      res.status(400);
      throw new Error(`TripBlock is already in ${tripBlock.status} state`);
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      res.status(404);
      throw new Error('Provider not found');
    }
    if (provider.status !== 'active') {
      res.status(400);
      throw new Error('Provider is currently not active or is busy');
    }

    // 2. Update TripBlock
    tripBlock.status = 'assigned';
    tripBlock.providerId = provider._id;
    await tripBlock.save();

    // 3. Update ServiceRequests status
    await ServiceRequest.updateMany(
      { _id: { $in: tripBlock.groupedRequests } },
      { $set: { status: 'assigned' } }
    );

    // 4. Update Provider status
    provider.status = 'busy';
    provider.availability = false;
    await provider.save();

    // 5. Create Assignment record (pending acceptance)
    const assignment = new Assignment({
      tripBlockId: tripBlock._id,
      providerId: provider._id,
      status: 'pending'
    });
    await assignment.save();

    // Populate for response/event
    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate({
        path: 'tripBlockId',
        populate: { path: 'groupedRequests' }
      })
      .populate('providerId', 'name phone serviceType rating');

    // 6. Emit socket event
    socketService.emitEvent('provider_assigned', populatedAssignment);

    res.status(201).json({
      success: true,
      data: populatedAssignment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Provider responds (accept or reject) to an assignment.
 * PUT /api/assignments/:id/respond
 */
const respondToAssignment = async (req, res, next) => {
  try {
    const { status } = req.body; // 'accepted' or 'rejected'
    if (!['accepted', 'rejected'].includes(status)) {
      res.status(400);
      throw new Error('Status must be either accepted or rejected');
    }

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      res.status(404);
      throw new Error('Assignment not found');
    }
    if (assignment.status !== 'pending') {
      res.status(400);
      throw new Error(`Assignment already responded to: current status is ${assignment.status}`);
    }

    const tripBlock = await TripBlock.findById(assignment.tripBlockId);
    const provider = await Provider.findById(assignment.providerId);

    if (status === 'accepted') {
      // Complete acceptance
      assignment.status = 'accepted';
      assignment.respondedAt = new Date();
      await assignment.save();
    } else {
      // Rejecting assignment: revert statuses
      assignment.status = 'rejected';
      assignment.respondedAt = new Date();
      await assignment.save();

      if (tripBlock) {
        tripBlock.status = 'pending';
        tripBlock.providerId = null;
        await tripBlock.save();

        await ServiceRequest.updateMany(
          { _id: { $in: tripBlock.groupedRequests } },
          { $set: { status: 'grouped' } }
        );
      }

      if (provider) {
        provider.status = 'active';
        provider.availability = true;
        await provider.save();
      }
    }

    res.status(200).json({
      success: true,
      data: assignment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Complete the TripBlock / Assignment.
 * POST /api/assignments/:id/complete
 */
const completeAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      res.status(404);
      throw new Error('Assignment not found');
    }
    if (assignment.status !== 'accepted') {
      res.status(400);
      throw new Error(`Cannot complete assignment: status is ${assignment.status}. Must be accepted first.`);
    }

    const tripBlock = await TripBlock.findById(assignment.tripBlockId).populate('groupedRequests');
    if (!tripBlock) {
      res.status(404);
      throw new Error('Associated TripBlock not found');
    }

    const provider = await Provider.findById(assignment.providerId);
    if (!provider) {
      res.status(404);
      throw new Error('Associated Provider not found');
    }

    // 1. Mark states completed
    assignment.status = 'completed';
    await assignment.save();

    tripBlock.status = 'completed';
    tripBlock.providerCost = provider.costPerTrip;
    await tripBlock.save();

    await ServiceRequest.updateMany(
      { _id: { $in: tripBlock.groupedRequests } },
      { $set: { status: 'completed' } }
    );

    provider.status = 'active';
    provider.availability = true;
    // Increment completion statistics internally (e.g. increase completionRate slightly)
    provider.completionRate = Math.min(1.0, (provider.completionRate || 0.9) + 0.01);
    await provider.save();

    // 2. Savings calculation
    const individualCosts = tripBlock.groupedRequests.map(r => r.individualCost);
    const actualSavings = savingsService.calculateSavings(individualCosts, provider.costPerTrip);

    // Save final actual savings to TripBlock (or update estimatedSavings to actual)
    tripBlock.estimatedSavings = actualSavings;
    await tripBlock.save();

    // 3. Create Analytics Record
    const requestCoordinates = tripBlock.groupedRequests.map(r => r.location.coordinates);
    const centroid = getCentroid(requestCoordinates);

    const analytics = new Analytics({
      tripBlockId: tripBlock._id,
      serviceType: tripBlock.serviceType,
      totalRequests: tripBlock.groupedRequests.length,
      savings: actualSavings,
      location: {
        type: 'Point',
        coordinates: centroid
      },
      completedAt: new Date()
    });
    await analytics.save();

    // 4. Emit socket events
    socketService.emitEvent('trip_completed', {
      assignmentId: assignment._id,
      tripBlockId: tripBlock._id,
      providerId: provider._id,
      savings: actualSavings
    });

    socketService.emitEvent('analytics_updated', analytics);

    res.status(200).json({
      success: true,
      message: 'Trip successfully completed and savings recorded.',
      data: {
        assignment,
        tripBlock,
        analytics
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAssignment,
  respondToAssignment,
  completeAssignment
};
