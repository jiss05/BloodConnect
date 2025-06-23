
const { google } = require('googleapis');


require('dotenv').config();
const nodemailer = require('nodemailer');


const OAuth2 = google.auth.OAuth2;
const env = require('./config.gmail.env'); // Ensure you have a config file with your environment variables
const oauth2Client = new OAuth2(
    env.ClientID, //Client ID
    env.client_secret, //Client Secret
    env.redirect_url //Redirect URL
);

oauth2Client.setCredentials({
    refresh_token: env.refresh_token //Refresh Token
});
const accessToken = oauth2Client.getAccessToken();
async function sendTextEmail(to, subject, body,attachments)
{
    const transporter = nodemailer.createTransport({
        service : "gmail",
        auth: {
            type : "OAuth2",
            user: env.emailId, // Your Gmail address
            clientId : env.ClientID,// Client ID
            clientSecret: env.client_secret, // Client Secret
            refreshToken: env.refresh_token, // Refresh Token
            accessToken: accessToken // Access Token    

        },
        tls: {
            rejectUnauthorized: false // Allow self-signed certificates
        }
    });
    var mailOptions = {
        from : env.emailId, // Your Gmail address
        to: to, // Recipient's email address    
        subject: subject, // Email subject
        html: body ,// Email body
        attachments: attachments // Attachments if any
    };
    transporter.sendMail(mailOptions, function (error,info){
        if (error){
            console.log(error);
        }
        else {
            console.log('Email sent: ' + info.response);
        }
        
    });
}



    module.exports.sendTextEmail= sendTextEmail;

