const sendEmail = require('./email');

const sendVerificationEmail = ({ email, name, verificationToken }) => {
  const verifyEmail = `http://localhost:${process.env.PORT}/api/v1/verify-email?token=${verificationToken}&email=${email}`;
  const message = `
  <h4> Hello, ${name} </h4>
  <p>
  Please confirm your email by clicking on the following link : 
  </p>
  <a href="${verifyEmail}">Verify Email</a> 
  `;

  return sendEmail({
    email: email,
    subject: 'Email confirmation',
    message: `
    ${message}
    `,
  });
};

module.exports = sendVerificationEmail;
