const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    required: [true, 'Farmer ID is required']
  },
  serviceType: {
    type: String,
    required: [true, 'Service type is required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required']
  },
  requestedDate: {
    type: String, // format YYYY-MM-DD
    required: [true, 'Requested date is required']
  },
  requestedTime: {
    type: String, // format HH:MM
    required: [true, 'Requested time is required']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'grouped', 'assigned', 'completed', 'cancelled'],
    default: 'pending'
  },
  individualCost: {
    type: Number,
    required: [true, 'Individual cost is required']
  },
  tripBlockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TripBlock',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create 2dsphere index on location for geospatial queries
serviceRequestSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
