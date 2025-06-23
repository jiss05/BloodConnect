const express=require('express')
const router=express();

const mongoose=require('mongoose');

const bcrypt =require('bcrypt') 
const jwt = require('jsonwebtoken');
const pdf = require('pdfmake');



const {login:usermodel}=require('../../../models/login');
const { Token } = require('../../../models/token');
const{isUser} =  require('../../../controllers/middleware');
const{Otp}= require('../../../models/otp');
const sendEmail = require('../../../controllers/email');
const {donation}= require('../../../models/doner');
const {getCoordinatesFromCity} = require('../../../utils/geocode');



const JWT_SECRET = '@this_is_secret_key'



// user registration

router.post('/register', async (req,res )=>{
    try {
        const { email,password,phoneno,name,role} = req.body;
        if (!email || !password || !phoneno || !role || !name) {
            return res.status(400).json({ status: false, message: 'All fields required' });
        }
        if (!/^[a-zA-Z0-9]+$/.test(name)) {
            return res.status(400).json({ status: false, message: 'Name should contain only alphanumeric characters' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ status: false, message: 'Invalid email format' });
        }
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(password)) {
            return res.status(400).json({ status: false, message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character' });
        }
        if (!/^\d{10}$/.test(phoneno)) {
            return res.status(400).json({ status: false, message: 'Phone number must be exactly 10 digits' });
        }
        const allowedRoles = ['user'];
        if (!allowedRoles.includes(role.toLowerCase())) {
            return res.status(400).json({ status: false, message: 'Role must be one of: user' });
        }
        // Check if user already exists
        const existingUser = await usermodel.findOne({ email: email, status: true });
        if (existingUser && existingUser.isverified) {
            return res.status(400).json({ status: false, message: 'User already exists with this email' });
        }

        //Hash password

        const newpassword = await bcrypt.hash(password, 10);

        //generate the otp
        const otp = Math.floor(100000 + Math.random() * 900000); // Generate a 6-digit OTP
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // OTP expires in 5 minutes

        // delete any existing OTP for this user
        await Otp.deleteMany({ email: email });
        
  if(!existingUser){
        const newuser = new usermodel({
            name: name,
            password: newpassword,
            role: role,
            email: email,
            phoneno: phoneno
        });
        await newuser.save();}
        else{
            existingUser.name = name;
            existingUser.password = newpassword;
            existingUser.role = role;
            existingUser.phoneno = phoneno;
            await existingUser.save();
        }

        //to get the user id
        const newuser = await usermodel.findOne({ email: email, status: true });


        // Save the OTP to the database
        const newOtp = new Otp({
            Loginid: newuser._id, // Use existing user ID or new user ID
            otp: otp,
            email: email,
            expiresAt: otpExpiry
        });

        await newOtp.save();
        // Send the OTP to the user's email

        await sendEmail.sendTextEmail(email, 'Your OTP Code', `Your OTP code is ${otp}. It is valid for 5 minutes.`);
         res.status(200).json({ status: true, message: 'OTP send Successfully' });
        } catch (error)

        {
         console.log(error);
        res.status(500).json({ status: false, message: 'Internal server error' });
        
        }
            });


     router.post('/verifyotp', async (req,res) => {
      try{
        const userOtp = req.body.otp;
        const {email} = req.body;

        const mainadmin = await usermodel.findOne({role: 'user', status: true});

        if(!userOtp || !email) {
            return res.status(400).json({ status: false, message: 'OTP and email are required' });
        }

        const verifyotp= await Otp.findOne({ email});
        if (!verifyotp) {
            return res.status(400).json({ status: false, message: 'OTP not found for this email' });
        }
        //checking the otp is correct
        if (verifyotp.otp !== userOtp) {
            return res.status(400).json({ status: false, message: 'Invalid OTP' });
        }
        //checking the otp is expired
        if (verifyotp.expiresAt < new Date()) {
            return res.status(400).json({ status: false, message: 'OTP has expired' });
        }
        if(verifyotp.otp === userOtp) {
            // Update user status to verified
            await usermodel.updateOne(
                { email: email },
                { $set: { isverified: true, status: true } }
            );

            const verifieduser = await usermodel.findOne({ _id: verifyotp.Loginid });
            
            //send to admin
            await sendEmail.sendTextEmail(mainadmin.email, 'New User Registration', `A new user has registered with the email: ${email}. Please verify their account.`);                

            return res.status(200).json({status:true, message:"OTP verified and user activated"});

    }
    else{
        return res.status(400).json({
            status:false,
            message:"Invalid OTP"

        });
    }
}
    catch (error){
        console.log(error);
        return res.status(500).json({
            status:false,
            message:"Something went wrong"
        });
    }
});


// user login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ status: false, message: 'Email and password are required' });
        }
        const user = await usermodel.findOne({ email: email, status: true });
        if (!user) {
            return res.status(401).json({ status: false, message: 'Invalid email or password' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ status: false, message: 'Invalid email or password' });
        }
        // generating token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            JWT_SECRET,
            { expiresIn: '1d' }
        );
        // Save token to database
        const newToken = new Token({
            login_id: user._id,
            token: token
        });
        await newToken.save();
        // Respond with success message and token
        res.status(200).json({ status: true, message: 'Login successful', token: token });

    } catch (error) {
        console.log(error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
});


// user logout
router.post('/logout', async (req, res) => {
  try {
    // Accept token from either 'Authorization' or 'token' header
    const token =
      req.headers['token'] ||
      (req.headers.authorization && req.headers.authorization.split(' ')[1]);

    if (!token) {
      return res.status(400).json({ status: false, message: 'Token required for logout' });
    }

    // Delete the token from DB
    await Token.deleteOne({ token });

    return res.status(200).json({ status: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
});



//doner route>>>>>>>>>


router.post('/donate', isUser, async (req, res) => {
  try {
    const {
      name,
      gender,
      age,
      bloodGroup,
      contactNumber,
      city,
      lastDonated,
      isFirstTimeDonor
    } = req.body;

    // 1. Check required fields
    if (!name || !gender || !age || !bloodGroup || !contactNumber || !city || typeof isFirstTimeDonor !== 'boolean') {
  return res.status(400).json({ status: false, message: 'All fields are required' });
}

if (!isFirstTimeDonor && !lastDonated) {
  return res.status(400).json({ status: false, message: 'Please provide last donated date for repeat donors' });
}

const finalLastDonated = isFirstTimeDonor ? null : lastDonated;


    // 2. Convert city to coordinates
    const coordinates = await getCoordinatesFromCity(city); // [lon, lat]
    if (!coordinates) {
      return res.status(400).json({ status: false, message: 'Invalid city name' });
    }

    // 3. Create new donor document
    const newDonor = new donation({
      loginId: req.user._id,
      name,
      gender,
      age,
      bloodGroup,
      contactNumber,
      city,
      lastDonated:finalLastDonated,
      isFirstTimeDonor,
      location: {
        type: 'Point',
        coordinates: coordinates
      },
      available: true, // mark donor as available by default
      isVerified: false // you can later toggle this manually or via email/OTP
    });

    await newDonor.save();



    //send email to the doner

    const subject = '🩸 Welcome to BloodConnect - Donor Registration Successful!';
            const body = `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background: #fdfdfd;">
            <div style="text-align: center; padding-bottom: 20px;">
            <h1 style="color: #d62828;">🩸 BloodConnect</h1>
            <h3 style="color: #2b2d42;">Donor Registration Confirmation</h3>
            </div>

            <div style="color: #2b2d42; font-size: 16px; line-height: 1.6;">
            <p>Hi <strong>${name}</strong>,</p>
            
            <p>Thank you for registering as a <span style="color: #d62828; font-weight: bold;">blood donor</span> with <strong>BloodConnect</strong>.</p>
            
            <p>Your support could help save a life. You're now part of a growing community of heroes. 💪</p>

            <p><strong>Location:</strong> ${city}<br>
                <strong>Blood Group:</strong> ${bloodGroup}</p>

            <p>We will contact you if someone near your area needs your help. Stay ready, and stay safe!</p>

            <div style="margin-top: 30px;">
                <a href="#" style="background: #d62828; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Visit BloodConnect</a>
            </div>

            <p style="margin-top: 40px;">With gratitude,<br><strong>Team BloodConnect</strong></p>
            </div>

            <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
            <div style="text-align: center; font-size: 13px; color: #888; padding-top: 10px;">
            © ${new Date().getFullYear()} BloodConnect | All rights reserved
            </div>
        </div>
        `;
        await sendEmail.sendTextEmail(req.user.email, subject, body, []);






    return res.status(201).json({
      status: true,
      message: 'Donor registered successfully',
      donor: newDonor
    });

  } catch (err) {
    console.error('Donor Registration Error:', err.message);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
});






module.exports= router;







