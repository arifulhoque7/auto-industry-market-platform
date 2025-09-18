const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  ownerId: {
    type: String,
    required: true,
    index: true
  },
  ownerName: {
    type: String,
    required: true
  },
  carDetails: {
    make: {
      type: String,
      required: true
    },
    model: {
      type: String,
      required: true
    },
    year: {
      type: Number,
      required: true
    },
    vin: String,
    mileage: Number
  },
  serviceType: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'medium'
  },
  location: {
    city: String,
    state: String,
    zipCode: String
  },
  preferredDate: Date,
  images: [String],
  status: {
    type: String,
    enum: ['open', 'quoted', 'accepted', 'in_progress', 'completed', 'cancelled'],
    default: 'open'
  },
  quotes: [{
    quoteId: String,
    shopId: String,
    shopName: String,
    totalCost: Number,
    estimatedHours: Number,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  acceptedQuote: {
    quoteId: String,
    shopId: String,
    shopName: String,
    totalCost: Number,
    acceptedAt: Date
  },
  metadata: {
    viewCount: {
      type: Number,
      default: 0
    },
    lastViewedAt: Date,
    tags: [String]
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
serviceRequestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create compound indexes for efficient queries
serviceRequestSchema.index({ status: 1, createdAt: -1 });
serviceRequestSchema.index({ 'carDetails.make': 1, 'carDetails.model': 1 });
serviceRequestSchema.index({ 'location.zipCode': 1, status: 1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);