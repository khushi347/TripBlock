const mongoose = require('mongoose');

const tripBlockSchema = new mongoose.Schema({
  serviceType: {
    type: String,
    required: [true, 'Service type is required'],
    trim: true
  },
  groupedRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceRequest',
    required: true
  }],
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    default: null
  },
  radiusCovered: {
    type: Number, // in meters
    required: true
  },
  estimatedSavings: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'completed', 'cancelled'],
    default: 'pending'
  },
  providerCost: {
    type: Number,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('TripBlock', tripBlockSchema);
