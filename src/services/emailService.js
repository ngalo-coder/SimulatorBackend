import nodemailer from 'nodemailer';
import logger from '../config/logger.js';

const sendEmail = async (options) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: 'Your App Name <yourapp@example.com>',
      to: options.email,
      subject: options.subject,
      text: options.message,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${options.email}`);
  } catch (error) {
    logger.error('Error sending email:', error);
    throw new Error('There was an error sending the email.');
  }
};

export default sendEmail;
