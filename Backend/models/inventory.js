const mongoose = require('mongoose');

const bloodInventorySchema = new mongoose.Schema({
  hospitalName: {
    type: String,
    required: true
  },
  bloodGroup: {
    type: String,
    required: true,
    enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
  },
  units: {
    type: Number,
    required: true,
    min: 1
  },
  city: {
    type: String,
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
  bloodAdded: {
    type: Date,
    required:true // This is what you'll use to calculate the 42-day expiry
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'login', // assuming login model includes hospital staff too
    required: true
  }
});

bloodInventorySchema.index({ location: '2dsphere' }); // for geospatial queries

const BloodInventory = mongoose.model('BloodInventory', bloodInventorySchema);

module.exports = { BloodInventory };
