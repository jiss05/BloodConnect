var jwt = require('jsonwebtoken');
const { login } = require('../models/login');

module.exports = {
    isAdmin : async function (req, res, next) {
        const token = req.headers['token'];
        if(token){
            try {
                const decoded = jwt.verify(token, '@this_is_secret_key');
                const user = await login.findOne({ _id: decoded.id, status: true });
                if(!user) {
                    return res.status(401).json({ status: false, message: 'Unauthorized' });
                }
                if(user.role !=='admin') {
                    return res.status(403).json({ status: false, message: 'Only admin can access' });
                }
                req.user = user;
                
            }catch (error) {
                return res.status(401).json({ status: false, message: 'Unauthorized' });
            }

            
            
        } 
        else{
            return res.status(401).json({ status: false, message: 'Unauthorized' });
        }
        next();
},


    isUser:async(req, res, next) => {
    const token=req.headers["token"];
    if(token){
        try{
            const decoded = jwt.verify(token, '@this_is_secret_key');
            const userData = await login.findOne({ _id: decoded.id, status: true });

            if (!userData) {
                return res.status(404).json({ status: false, message: "User not found" });
            }
            if (userData.role !== 'user') {
                return res.status(403).json({ status: false, message: "Access denied" });
            }

            req.user = userData; // Attach user data to the request object
        }
        catch(error){
            return res.status(401).json({ status: false, message: "Not verified" });
        }
    }
    else{
        return res.status(401).json({ status: false, message: "invalid token" });
    }
    next()
  }
}