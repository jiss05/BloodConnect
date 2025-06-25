const express=require('express')
const router=express();

const bcrypt =require('bcrypt') 
const jwt = require('jsonwebtoken');



const {login}=require('../../../models/login');
const { Token } = require('../../../models/token');
const{isAdmin}= require('../../../controllers/middleware');





//secret key

const JWT_SECRET = '@this_is_secret_key'




//admin registration


router.post('/register',async (req,res) => {
    try {
        const {name,password,phoneno,role,email}= req.body;
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

const allowedRoles = ['admin'];
if (!allowedRoles.includes(role.toLowerCase())) {
    return res.status(400).json({ status: false, message: 'Role must be admin' });
}

const existingUser = await login.findOne({ email });
if (existingUser) {
      return res.status(400).json({ status: false, message: 'Email already registered' });
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
            message: 'Admin registered successfully',
            token: token
        });  

        }catch (error) {
        console.log(error);


        res.status(500).json({status : false,message : 'somthing went wrong'});
        
    }
    
});

//admin login
router.post('/login', async (req, res) => {
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

    //Check role if only admin should be allowed to login
    if (user.role !== 'admin') {
      return res.status(403).json({ status: false, message: 'Access denied. Not an admin.' });
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




// get all the users..>/admin/users?role=donor&search=john
router.get('/users', isAdmin, async (req, res) => {
  try {
    const { role, search } = req.query;

    let query = {};

    if (role) {
      query.role = role.toLowerCase(); // filter by role: 'admin', 'user', 'hospitalstaff'
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneno: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await login.find(query).select('-password -__v');

    res.status(200).json({
      status: true,
      message: 'Users fetched successfully',
      count: users.length,
      data: users
    });

  } catch (error) {
    console.error('Admin Fetch Users Error:', error);
    res.status(500).json({ status: false, message: 'Internal server error' });
  }
});

// deactivate users

router.put('/deactivateuser/:id', isAdmin , async(req,res)=>{
  try {
    const userId = req.params.id;
    const user = await login.findById(userId);
    if (!user) {
            return res.status(404).json({ status: false, message: 'User not found' });
        }
     user.status=false;
     await user.save();
     res.status(200).json({ status: true, message: 'User deactivated successfully' });

    
  } catch (error) {
    console.log(error)
    return res.status(500).json({status:false,message:'Something Went Wrong'});
    
  }
});

router.put('/activateuser/:id',isAdmin, async(req,res)=>{
  try {
    const userId=req.params.id;
    const user = await login.findById(userId);
    if(!user){
      return res.status(404).json({ status: false, message: 'User not found' });

    }
    user.status=true;
    await user.save();
    res.status(200).json({status:true,message:'User activated successfully'});
    
  } catch (error) {
    console.log(error)
    return res.status(500).json({status:false,message:'Something Went Wrong'});

    
  }
});






module.exports= router;
