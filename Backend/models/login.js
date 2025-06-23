const mongoose=require('mongoose');



const login_schema = new mongoose.Schema
({email : {type : String},

 password : {type : String} ,
 phoneno : {
    type : Number

 },
 name : {
    type : String
 },
 

    role : {
             type : String , 
             enum :['admin','user','hospital']
             },
             
status : {type : Boolean,
          default : true
          },
isverified : {
            type : Boolean,
            default : false
          }
                                          

 });
const login = mongoose.model('login',login_schema);

module.exports = {login};

