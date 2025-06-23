const mongoose = require('mongoose');

const donorSchema = new mongoose.Schema({
  loginId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'login',
    required: true
  },

  name: {
    type: String,
    required: true
  },

  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true
  },

  age: {
    type: Number,
    required: true
  },

  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true
  },

  contactNumber: {
    type: String,
    required: true
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

  lastDonated: {
  type: Date,
  default: null// enforce that it must be sent explicitly
},
isFirstTimeDonor: {
  type: Boolean,
  required: true
},


  available: {
    type: Boolean,
    default: true // true means eligible to donate
  },

  isVerified: {
    type: Boolean,
    default: false // manual or hospital verification
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Enable geospatial search
donorSchema.index({ location: '2dsphere' });

const donation = mongoose.model('donation',donorSchema);

module.exports = {donation};
