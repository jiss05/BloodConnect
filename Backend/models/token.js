const mongoose=require('mongoose')


const token_schema = new mongoose.Schema
    ({ login_id :
         {
             type : mongoose.Schema.Types.ObjectId,
             ref : 'login'
         },

         token :
         {
            type : String
         }

                                          

        });
const Token= mongoose.model('Token',token_schema);

module.exports = {Token};

