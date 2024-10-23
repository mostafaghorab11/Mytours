const sendEmail = require('./email');
require('dotenv').config();

const sendVerificationEmail = async ({ email, name, verificationToken }) => {
  const verifyEmail = `${process.env.PRODUCTION_URL}/api/v1/verify-email?token=${verificationToken}`;
  const message = `
  <h4> Hello, ${name} </h4>
  <p>
  Please confirm your email by clicking on the following link : 
  </p>
  <a href="${verifyEmail}">Verify Email</a> 
  `;
  
  await sendEmail({
    email: email,
    subject: 'Email confirmation',
    message: `
    ${message}
    `,
  });
};

module.exports = sendVerificationEmail;
