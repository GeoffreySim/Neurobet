const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
  port: process.env.BREVO_SMTP_PORT ? parseInt(process.env.BREVO_SMTP_PORT) : 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS
  }
});

function sendMail({ to, subject, text, html }) {
  return transporter.sendMail({
    from: process.env.BREVO_FROM || 'notifications@neurobet.com',
    to,
    subject,
    text,
    html
  });
}

module.exports = { sendMail }; 