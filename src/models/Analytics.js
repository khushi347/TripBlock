const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  tripBlockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TripBlock',
    required: true
  },
  serviceType: {
    type: String,
    required: true,
    trim: true
  },
  totalRequests: {
    type: Number,
    required: true
  },
  savings: {
    type: Number,
    required: true
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
  completedAt: {
    type: Date,
    default: Date.now
  }
});

analyticsSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Analytics', analyticsSchema);
