// utils/templates/emailTemplates.js

const emailBodyForDonor = ({ name, patientName, bloodGroup, city, contact }) => `
  <div style="font-family: Arial, sans-serif; background: #fff3f3; padding: 20px; border-radius: 10px;">
    <h1 style="color: #e63946; text-align:center;">BloodConnect🩸</h1>
    <h2 style="color: #d62828;">🚑 Blood Needed Urgently</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>A patient near your area needs your help.</p>
    <ul>
      <li><strong>Patient Name:</strong> ${patientName}</li>
      <li><strong>Blood Group:</strong> ${bloodGroup}</li>
      <li><strong>City:</strong> ${city}</li>
      <li><strong>Requester Contact:</strong> ${contact}</li>
    </ul>
    <p>If you're eligible, please consider donating 🙏</p>
    <br/>
    <p style="font-size: 14px;">Thank you for being a hero ❤️</p>
  </div>
`;

module.exports = { emailBodyForDonor };
