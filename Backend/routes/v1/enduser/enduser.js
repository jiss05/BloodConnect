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
const {bloodrequest}= require('../../../models/request');
const {getCompatibleGroups} = require('../../../utils/bloodgroupmatch');
const {BloodInventory }= require('../../../models/inventory');
const {emailBodyForDonor } = require('../../../utils/templates/emailtemplates');
const generateBloodMatchPDF=require('../../../utils/generatePdf');




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



router.post('/forgotpassword', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ status: false, message: 'Email is required' });
    }

    const user = await usermodel.findOne({ email });
    if (!user) {
      return res.status(404).json({ status: false, message: 'No account associated with this email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    // clear old OTPs 
    await Otp.deleteMany({ email });

    // Save OTP
    await Otp.create({
      Loginid: user._id,
      otp,
      email,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    // Email
    const subject = `BloodConnect - Password Reset OTP`;
    const htmlBody = `
      <p>Hi ${user.name},</p>
      <p>Your OTP to reset your password is: <strong>${otp}</strong></p>
      <p>This OTP will expire in 5 minutes. Do not share it with anyone.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `;

    await sendEmail.sendTextEmail(email, subject, htmlBody);

    return res.status(200).json({ status: true, message: 'OTP has been sent to your registered email.' });

  } catch (error) {
    console.error('Forgot Password Error:', error);
    return res.status(500).json({ status: false, message: 'Something went wrong, please try again.' });
  }
});

//verify otp
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  const record = await Otp.findOne({ email, otp });
  if (!record) {
    return res.status(400).json({ status: false, message: 'Invalid or expired OTP' });
  }

  await Otp.deleteMany({ email }); // clear used OTP

  const verifiedToken = jwt.sign(
    { email, purpose: 'reset-password' },
    JWT_SECRET,
    { expiresIn: '10m' }
  );

  return res.status(200).json({
    status: true,
    message: 'OTP verified successfully',
    verifiedToken
  });
});


//reset password

router.post('/reset-password', async (req, res) => {
  const { verifiedToken, newPassword, confirmNewPassword } = req.body;

  if ( !newPassword || !confirmNewPassword) {
    return res.status(400).json({ status: false, message: 'All fields are required' });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ status: false, message: 'Passwords do not match' });
  }

  const decoded = jwt.verify(verifiedToken, JWT_SECRET);

  if (decoded.purpose !== 'reset-password') {
    return res.status(403).json({ status: false, message: 'Invalid token purpose' });
  }

  const user = await usermodel.findOne({ email: decoded.email });
  if (!user) {
    return res.status(404).json({ status: false, message: 'User not found' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  await user.save();

  return res.status(200).json({ status: true, message: 'Password reset successfully' });
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


//>>>>>>>>>>>>>>USER REQUSTING BLOOD >>>>>>>>>>>>>>>>>>>USER REQUSTING BLOOD >>>>>>>>>>>>>>>>>>>>>>>>>USER REQUSTING BLOOD >>>>>>>>>>>>>>>>>>>>USER REQUSTING BLOOD >>>>>>>>>>>>>>>USER REQUSTING BLOOD >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>



router.post('/requestblood', isUser, async(req,res)=>{
    try {

        const { patientName,city,bloodGroup,unitsNeeded,hospitalName}=req.body;


        if(!patientName||!city||!bloodGroup||!unitsNeeded||!hospitalName){
            return res.status(400).json({status:false,message:'All fields are required'});
        }


        //bloodgroupvalidation
        const validBloodGroup = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
        if(!validBloodGroup.includes(bloodGroup)){
            return res.status(400).json({status:false,message:'BLOOD GROUPS SHOULD BE A+, A-, B+, B-, O+, O-, AB+, AB-'});

        }


        
        //get coordinates of city
        const coordinates = await getCoordinatesFromCity(city);
        if(!coordinates){
            return res.status(400).json({status:false,message:'Invalid City'});

        }
        //get compatible blood groups
        const compatibleGroups = getCompatibleGroups(bloodGroup);

        // to check the eligliblity if it's been 90+ days since last donation.
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        const donorsRaw = await donation.find({
        bloodGroup: { $in: compatibleGroups },
        available: true,
        $or: [
            { isFirstTimeDonor: true },
            { lastDonated: { $lte: ninetyDaysAgo } }//checking here
        ],
        location: {
            $near: {
            $geometry: { type: 'Point', coordinates },
            $maxDistance: 10000//find doners within 10kms 
            }
        }
        })
        .select('name gender age bloodGroup contactNumber city lastDonated isFirstTimeDonor')
        .populate('loginId','email');
        

        //adding tag to each doner 
         let donors = [];

    if (donorsRaw.length > 0) {
      donors = donorsRaw.map(doner => ({
        ...doner._doc,
        donertype: doner.isFirstTimeDonor ? 'Not Donated Yet' : 'Regular donor'
      }));
    } else {
      donors = 'No eligible donors found within 10km radius.';
    }

    //  Find matching hospital inventories
    const inventory = await BloodInventory.find({
     bloodgroups: {
         $elemMatch: {
           bloodGroup: { $in: compatibleGroups },
           units: { $gte: unitsNeeded },
           bloodAdded: { $gte: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000) }
    }
  },
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates },
        $maxDistance: 10000
    }
  }
})
    .select('hospitalName bloodgroups city contactNumber')
    .populate('createdBy','email name');

    const inventoryData= inventory.length>0? inventory:[];
    const inventoryMessage= inventory.length == 0? 'No matching blood inventory found within 10km radius.':null;

    //saving the req to db
    await bloodrequest.create({
        requestedBy:req.user._id,
        patientName,
        hospitalName,
        city,
        bloodGroup,
        unitsNeeded,
        location:{
            type: 'Point',
            coordinates:coordinates
        }
    });


        
        //NOTIFY DONERS
        const requesterContact = req.user.phoneno;
        for (const donor of donorsRaw) {
        const donorEmail =donor?.loginId?.email;    
        if (donorEmail) {
            await sendEmail.sendTextEmail(
            donorEmail,
            "🩸 Blood Request Near You",
            emailBodyForDonor({
                name: donor.name,
                patientName,
                bloodGroup,
                city,
                contact: requesterContact
            }),
            []
            );
        }
        }



        // Notify hospitals
        for (const inv of inventory) {
        const hospitalEmail = inv?.createdBy?.email;
        if (hospitalEmail) {
            await sendEmail.sendTextEmail(
            hospitalEmail,
            "🩸 Blood Inventory Requested",
            emailBodyForDonor({
                name: inv?.createdBy.name,
                patientName,
                bloodGroup,
                city,
                contact: requesterContact
            }),
            []
            );
        }
        }


     //Generate pdf and return a downloadlink
        generateBloodMatchPDF(donorsRaw, inventoryData, async (err, filePath) => {
        if (err) {
            console.error('pdf generation failed', err);
            return res.status(500).json({
            status: false,
            message: 'Internal server error while generating PDF'
            });
        }

        const path = require('path');
        const fileName = path.basename(filePath);
        const downloadUrl = `${req.protocol}://${req.get('host')}/public/${fileName}`;

        //email to the requester with pdf

        const subject=' BloodConnect - Donor & Inventory Matches';
        const htmlBody=
         `
        <p>Dear ${req.user.name},</p>
        <p>Attached is the detailed PDF containing matching donors and hospital blood inventory for your request of <strong>${bloodGroup}</strong> (${unitsNeeded} units) at <strong>${hospitalName}</strong>, ${city}.</p>
        <p>Thank you for using BloodConnect.</p>
        <br>
        <p>– Team BloodConnect</p>
      `;

      await sendEmail.sendTextEmail(
        req.user.email,
        subject,
        htmlBody,
        [{
            filename:'Donor_Inventory_match.pdf',
            path:filePath,
            contentType:'application/pdf'

        }] //pdf file attached here
      );

        return res.status(200).json({
            status: true,
            message: 'Matching donors and hospital inventory fetched successfully',
            data: {
            patientName,
            requestedUnits: unitsNeeded,
            hospitalName,
            bloodGroup,
            donors,
            inventory: inventoryData,
            inventoryMessage,
            pdfUrl: downloadUrl
            }
        });
    });
    }catch(error){
        console.log(error)
        res.status(500).json({status: false, message: 'Internal server error' })

    }
});


// get requestblood history
router.get('/requestbloodhistory', isUser, async (req, res) => {
  try {
    const requests = await bloodrequest.find({ requestedBy: req.user._id })
      .sort({ createdAt: -1 }); // newest first

    return res.status(200).json({
      status: true,
      message: 'Your blood request history fetched successfully',
      data: requests
    });
  } catch (err) {
    console.error('Error fetching history:', err);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
});




module.exports= router;







