const mongoose = require('mongoose');

const bloodrequestSchema = new mongoose.Schema({
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'login',
    required: true
  },

  patientName:{
    type:String,
    required:true
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
    required: true
  },
  unitsNeeded: {
    type: Number,
    required: true,
    min: 1
  },
  city: {
    type: String,
    required: true
  },
  reason: {
    type: String,
  },
  hospitalName: {
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
  matchingDonors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'donation'
  }],
  matchingInventories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BloodInventory'
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'completed', 'rejected'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  }
});

bloodrequestSchema.index({ location: '2dsphere' }); // enables geospatial queries

const bloodrequest = mongoose.model('bloodrequest', bloodrequestSchema);

module.exports = { bloodrequest };
