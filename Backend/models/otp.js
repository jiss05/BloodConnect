const express = require('express');
const mongoose = require('mongoose');       
const otpSchema = new mongoose.Schema({
    Loginid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'login', // Reference to the login model
    },
    otp: {
        type: Number,
        required: true
    },

    email: {
        type: String,
    },
     expiresAt: {
        type: Date,
        default: Date.now,
        expires: '5m' // OTP will expire after 5 minutes
    }
});
const Otp = mongoose.model('Otp', otpSchema);
module.exports = { Otp };