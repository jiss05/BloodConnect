const express=require('express')

const router=express.Router();

const mongoose=require('mongoose');

const bcrypt =require('bcrypt') 
const jwt = require('jsonwebtoken');
const pdf = require('pdfmake');



const {login}=require('../../../models/login');
const { Token } = require('../../../models/token');
const  {isHospitalStaff} = require('../../../controllers/middleware');
const{Otp}= require('../../../models/otp');
const sendEmail = require('../../../controllers/email');
const {BloodInventory} = require('../../../models/inventory');
const {getCoordinatesFromCity} = require('../../../utils/geocode');
const {donation}= require('../../../models/doner');



const JWT_SECRET = '@this_is_secret_key'


//hospitaladmin registration

router.post('/hospitalstaffregister',async (req,res) => {
    try {
        const {name,password,phoneno,role,email}= req.body;
        if (!email || !password || !phoneno || !role || !name) {
    return res.status(400).json({ status: false, message: 'All fields required' });
}

if (!/^[a-zA-Z\s.]+$/.test(name)) {
  return res.status(400).json({ status: false, message: 'Name should contain only letters, spaces, or dots' });
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

const allowedRoles = ['hospital'];
if (!allowedRoles.includes(role.toLowerCase())) {
    return res.status(400).json({ status: false, message: 'Role must be hospitalstaff' });
}

    
            
            
     const newpassword = await bcrypt.hash(password,10) 
     const newuser = new login({
        name : name,
        password : newpassword,
        role : role,
        email : email,
        phoneno : phoneno
          });
          await newuser.save();
            
          // generating token
          const token = jwt.sign(
            {id : newuser.id, email: newuser.email, role: newuser.role},
            JWT_SECRET,
            {expiresIn: '1h'}
          );
          //save tocken to db
          const tokenentry = new Token ({ login_id: newuser._id,token:token});
          await tokenentry.save();

        res.status(200).json({
            status: true,
            message: 'User registered successfully',
            token: token
        });  

        }catch (error) {
        console.log(error);


        res.status(500).json({status : false,message : 'somthing went wrong'});
        
    }
    
});



//hospitalstaff login
router.post('/hospitalstafflogin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: false, message: 'Email and password are required' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ status: false, message: 'Invalid email format' });
    }

    // Check user in DB
    const user = await login.findOne({ email });
    if (!user) {
      return res.status(400).json({ status: false, message: 'User not found' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ status: false, message: 'Invalid password' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '5h' }
    );

    // Save token
    const tokenentry = new Token({ login_id: user._id, token });
    await tokenentry.save();

    res.status(200).json({
      status: true,
      message: 'Login successful',
      token
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ status: false, message: 'Something went wrong' });
  }
});


// hospital staff adds blood units to inventory
router.post('/inventory/add', isHospitalStaff, async (req, res) => {
  try {
    const { hospitalName, bloodGroup, units, city, bloodAdded } = req.body;

    if (!hospitalName || !bloodGroup || !units || !city) {
      return res.status(400).json({ status: false, message: 'All required fields must be provided' });
    }

    // Convert city to coordinates
    const coordinates = await getCoordinatesFromCity(city);
    if (!coordinates) {
      return res.status(400).json({ status: false, message: 'Invalid city name' });
    }

    const newInventory = new BloodInventory({
      hospitalName,
      bloodGroup,
      units,
      city,
      bloodAdded: bloodAdded || new Date(), // defaults to today if not given
      location: {
        type: 'Point',
        coordinates: coordinates
      },
      createdBy: req.user._id
    });

    await newInventory.save();

    return res.status(201).json({
      status: true,
      message: 'Blood inventory added successfully',
      data: newInventory
    });

  } catch (error) {
    console.error('Inventory Add Error:', error.message);
    return res.status(500).json({ status: false, message: 'Internal Server Error' });
  }
});





// Get all registered donors
router.get('/donors', isHospitalStaff, async (req, res) => {
  try {
    const donors = await donation.find()
      .select('name gender age bloodGroup contactNumber city lastDonated isFirstTimeDonor available isVerified createdAt');

    return res.status(200).json({
      status: true,
      message: 'List of all donors',
      data: donors
    });
  } catch (error) {
    console.error('Error fetching donors:', error);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
});



// get donors by blood group 
router.get('/donors/bygroup/:group', isHospitalStaff, async (req, res) => {
  try {
    const group = req.params.group.toUpperCase();
    const validGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    
    if (!validGroups.includes(group)) {
      return res.status(400).json({ status: false, message: 'Invalid blood group' });
    }

    const donors = await donation.find({ bloodGroup: group })
      .select('name gender age bloodGroup contactNumber city lastDonated isFirstTimeDonor available isVerified createdAt');

    return res.status(200).json({
      status: true,
      message: `List of ${group} donors`,
      data: donors
    });
  } catch (error) {
    console.error('Error fetching donors by group:', error);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
});






module.exports= router;


