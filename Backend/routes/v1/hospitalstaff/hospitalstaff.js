const express=require('express')

const router=express.Router();

const mongoose=require('mongoose');

const bcrypt =require('bcrypt') 
const jwt = require('jsonwebtoken');
const pdf = require('pdfmake');
const path = require('path');


const {login}=require('../../../models/login');
const { Token } = require('../../../models/token');
const  {isHospitalStaff} = require('../../../controllers/middleware');
const{Otp}= require('../../../models/otp');
const sendEmail = require('../../../controllers/email');
const {BloodInventory} = require('../../../models/inventory');
const {getCoordinatesFromCity} = require('../../../utils/geocode');
const {donation}= require('../../../models/doner');
const generateBloodMatchPDF=require('../../../utils/generatePdf');
const { group, error } = require('console');
const generateInventoryListPDF=require('../../../utils/generateinventorylistpdf');



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

//hospitalstaff logout
router.post('/hospitalstafflogout', isHospitalStaff, async (req, res) => {
  try {
    const token = req.headers['token'];
    if (!token) {
      return res.status(400).json({ status: false, message: 'Token is required' });
    }

    await Token.findOneAndDelete({ token });

    return res.status(200).json({ status: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({ status: false, message: 'Internal server error' });
  }
});
//forgot password

router.post('/forgotpassword', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ status: false, message: 'Email is required' });
    }

    const user = await login.findOne({ email });
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

  const user = await login.findOne({ email: decoded.email });
  if (!user) {
    return res.status(404).json({ status: false, message: 'User not found' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  await user.save();

  return res.status(200).json({ status: true, message: 'Password reset successfully' });
});





// hospital staff adds or updates blood units to inventory
router.post('/inventory/add', isHospitalStaff, async (req, res) => {
  try {
    const { hospitalName, bloodgroups, city, contactNumber } = req.body;

    if (!hospitalName || !bloodgroups || !Array.isArray(bloodgroups) || bloodgroups.length === 0 || !city || !contactNumber) {
      return res.status(400).json({ status: false, message: 'All required fields must be provided' });
    }

    //  Validate each blood group entry:
    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    for (let group of bloodgroups) {
      if (!group.bloodGroup || !validBloodGroups.includes(group.bloodGroup)) {
        return res.status(400).json({ status: false, message: `Invalid blood group: ${group.bloodGroup}` });
      }
      // Add today's date if not provided
      if (!group.bloodAdded) {
        group.bloodAdded = new Date();
      }
    }

    // convert city to coordinates
    const coordinates = await getCoordinatesFromCity(city);
    if (!coordinates) {
      return res.status(400).json({ status: false, message: 'Invalid city name' });
    }

    // check if an inventory entry already exists
    let existingInventory = await BloodInventory.findOne({
      hospitalName,
      city,
      createdBy: req.user._id
    });

    if (existingInventory) {
      // if exists, merge or update bloodgroups
      for (let newGroup of bloodgroups) {
        const existingGroup = existingInventory.bloodgroups.find(bg => bg.bloodGroup === newGroup.bloodGroup);
        if (existingGroup) {
          // If already exists, update units and date
          existingGroup.units += newGroup.units;
          existingGroup.bloodAdded = new Date(newGroup.bloodAdded || Date.now());
        } else {
          // If not exists, add new group entry
          existingInventory.bloodgroups.push({
            bloodGroup: newGroup.bloodGroup,
            units: newGroup.units,
            bloodAdded: new Date(newGroup.bloodAdded || Date.now())
          });
        }
      }

      await existingInventory.save();

      return res.status(200).json({
        status: true,
        message: 'Existing inventory updated successfully',
        data: existingInventory
      });

    } else {
      // if not exists, create new entry
      const newInventory = new BloodInventory({
        hospitalName,
        bloodgroups,
        city,
        contactNumber,
        location: {
          type: 'Point',
          coordinates
        },
        createdBy: req.user._id
      });

      await newInventory.save();

      return res.status(201).json({
        status: true,
        message: 'New blood inventory created successfully',
        data: newInventory
      });
    }

  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: 'Internal Server Error' });
  }
});


//get all registered inventories
router.get('/getinventorylist', isHospitalStaff, async (req, res) => {
  try {
    const inventories = await BloodInventory.find({
      createdBy: { $ne: req.user._id }//used to exclude the hospitalstaff who is searching
    })
      .select('-__v') //  exclude version in front
      .populate('createdBy', 'name email'); //show who created it

    if (!inventories || inventories.length === 0) {
      return res.status(404).json({ status: false, message: 'No other inventories found' });
    }

    generateInventoryListPDF(inventories,(error,filePath)=>{
      if(error){
        console.log(error);
        return res.status(500).json({ status: false, message: 'Failed to generate PDF' });

      }
      const path = require('path');
      const fileName = path.basename(filePath);
      const downloadUrl = `${req.protocol}://${req.get('host')}/public/${fileName}`;

    

    return res.status(200).json({
      status: true,
      message: 'Inventories fetched successfully',
      downloadUrl,
      count:inventories.length,
      data: inventories
      
    });
    });

  } catch (error) {
    console.error('Error fetching inventories:', error);
    return res.status(500).json({ status: false, message: 'Internal server error' });
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
      
      
    if (!donors || donors.length === 0) {
      return res.status(404).json({ status: false, message: `No donors found for ${group}` });
    }

    // Generate the PDF
    generateBloodMatchPDF(donors, [], async (err, filePath) => {
      if (err) {
        console.error('PDF generation failed', err);
        return res.status(500).json({ status: false, message: 'Failed to generate PDF' });
      }

      const path = require('path');
      const fileName = path.basename(filePath);
      const downloadUrl = `${req.protocol}://${req.get('host')}/public/${fileName}`;

      // Send email to the logged-in hospital staff
      const subject = `BloodConnect - ${group} Donors List`;
      const htmlBody = `
        <p>Dear ${req.user.name},</p>
        <p>Attached is the detailed PDF list of all donors with blood group <strong>${group}</strong>.</p>
        <p>You can also download it from: <a href="${downloadUrl}">${downloadUrl}</a></p>
        <p>– Team BloodConnect</p>
      `;

      await sendEmail.sendTextEmail(
        req.user.email,
        subject,
        htmlBody,
        [{
          filename: `${group}_Donors_List.pdf`,
          path: filePath,
          contentType: 'application/pdf'
        }]
      );


    return res.status(200).json({
      status: true,
      message: `List of ${group} donors emailed successfully`,
      downloadUrl,
      data: donors
    });
  });
  } catch (error) {
    console.error('Error fetching donors by group:', error);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
});


// adds a new blood group entry to existing inventory document
router.patch('/inventory/:id/add-bloodgroup', isHospitalStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { bloodGroup, units, bloodAdded } = req.body;

    // Validation
    const validGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    if (!bloodGroup || !units) {
      return res.status(400).json({ status: false, message: 'Blood group and units are required' });
    }

    if (!validGroups.includes(bloodGroup)) {
      return res.status(400).json({ status: false, message: 'Invalid blood group provided' });
    }

    const inventory = await BloodInventory.findById(id);
    if (!inventory) {
      return res.status(404).json({ status: false, message: 'Inventory document not found' });
    }

    // Authorization check
    if (inventory.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ status: false, message: 'Unauthorized to update this inventory' });
    }

    // Check for duplicate blood group
    const alreadyExists = inventory.bloodgroups.find(bg => bg.bloodGroup === bloodGroup);
    if (alreadyExists) {
      return res.status(409).json({ status: false, message: `Blood group ${bloodGroup} already exists. Use update route instead.` });
    }

    // Add new group
    inventory.bloodgroups.push({
      bloodGroup,
      units,
      bloodAdded: bloodAdded || new Date()
    });

    await inventory.save();

    return res.status(200).json({
      status: true,
      message: `Blood group ${bloodGroup} added successfully to inventory`,
      data: inventory
    });

  } catch (error) {
    console.error('Error adding blood group:', error.message);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
});




// Update a specific blood group entry in the inventory
router.patch('/inventory/:id/bloodgroup/:group', isHospitalStaff, async (req, res) => {
  try {
    const { id, group } = req.params; // inventory id and bloodGroup name (e.g., B+)
    const { units, bloodAdded } = req.body;


    if (!units || isNaN(units)) {
      return res.status(400).json({ status: false, message: 'Units must be a valid number' });
    }

    // Find inventory 
    const inventoryItem = await BloodInventory.findById(id);
    if (!inventoryItem) {
      return res.status(404).json({ status: false, message: 'Inventory item not found' });
    }
    //verify ownership
    if (inventoryItem.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ status: false, message: 'Unauthorized to update this entry' });
    }

    // Find the specific blood group entry
    const targetGroup = inventoryItem.bloodgroups.find(bg => bg.bloodGroup === group.toUpperCase());

    if (!targetGroup) {
      return res.status(404).json({ status: false, message: `Blood group ${group} not found in inventory` });
    }

    // Update values
    targetGroup.units = units;
    if (bloodAdded) {
      targetGroup.bloodAdded = new Date(bloodAdded);
    }

    await inventoryItem.save();

    return res.status(200).json({
      status: true,
      message: `Blood group ${group} updated successfully`,
      data: inventoryItem
    });

  } catch (error) {
    console.error('Partial blood group update error:', error);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
});

//update contact number
router.patch('/inventory/:id/contact', isHospitalStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { contactNumber } = req.body;

    if (!contactNumber) {
      return res.status(400).json({ status: false, message: 'Contact number is required' });
    }

    const inventory = await BloodInventory.findById(id);
    if (!inventory) {
      return res.status(404).json({ status: false, message: 'Inventory not found' });
    }

    // Ensure only the hospital staff who created the entry can update
    if (inventory.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ status: false, message: 'Unauthorized update attempt' });
    }

    inventory.contactNumber = contactNumber;
    await inventory.save();

    return res.status(200).json({
      status: true,
      message: 'Contact number updated successfully'
    });

  } catch (error) {
    console.error('Contact update error:', error.message);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
});





//delete route

router.delete('/inventory/:id',isHospitalStaff,async(req,res)=>{
    try {
        const inventoryId = req.params.id;

        const deleted = await BloodInventory.findOneAndDelete({
            _id: inventoryId,
            createdBy: req.user._id //tomake sure only staff del data
        });

        if (!deleted){
            return res.status(404).json({status:false, message:'Inventory not found or unauthorized'});

        }

        return res.status(200).json({status:true,message:'Inventory deleted successfully'});

        
    } catch (error) {
        console.log(error);
        return res.status(500).json({status:false,message:'Something went wrong'});
        
    }
});
// Delete a specific blood group from inventory
router.delete('/inventory/:id/bloodgroup/:group', isHospitalStaff, async (req, res) => {
  try {
    const { id, group } = req.params;

    // Find the inventory document by ID
    const inventory = await BloodInventory.findById(id);
    if (!inventory) {
      return res.status(404).json({ status: false, message: 'Inventory document not found' });
    }

    // Check ownership
    if (inventory.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ status: false, message: 'You are not authorized to update this inventory' });
    }

    // Filter out the group to be deleted
    const initialLength = inventory.bloodgroups.length;
    inventory.bloodgroups = inventory.bloodgroups.filter(bg => bg.bloodGroup !== group.toUpperCase());

    // If no change, the group didn't exist
    if (inventory.bloodgroups.length === initialLength) {
      return res.status(404).json({ status: false, message: `Blood group ${group} not found in inventory` });
    }

    await inventory.save();

    return res.status(200).json({
      status: true,
      message: `Blood group ${group} deleted successfully`,
      data: inventory
    });

  } catch (error) {
    console.error('Delete blood group error:', error);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
});



// view hospital  current inventory
router.get('/viewinventory', isHospitalStaff, async (req, res) => {
  try {
    const inventory = await BloodInventory.findOne({ createdBy: req.user._id })
      .select('-__v')
      .populate('createdBy', 'name email');

    if (!inventory) {
      return res.status(404).json({ status: false, message: 'No inventory found for this hospital staff' });
    }

    return res.status(200).json({
      status: true,
      message: 'Current inventory fetched successfully',
      data: inventory
    });
  } catch (error) {
    console.error('Error fetching current inventory:', error);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
});






module.exports= router;


