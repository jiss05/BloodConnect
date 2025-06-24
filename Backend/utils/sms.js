// utils/sms.js
const axios = require('axios');

async function sendSMS(number, message) {
  try {
    const response = await axios.post("https://www.fast2sms.com/dev/bulkV2", {
      route: "q", // quick message
      message: message,
      language: "english",
      flash: 0,
      numbers: number
    }, {
      headers: {
        "authorization": process.env.FAST2SMS_API_KEY,
        "Content-Type": "application/json"
      }
    });

    if (response.data.return) {
      console.log(`SMS sent successfully to ${number}`);
    } else {
      console.log(`Failed to send SMS:`, response.data);
    }
  } catch (error) {
    console.error("SMS sending error:", error.message);
  }
}

module.exports = { sendSMS };
