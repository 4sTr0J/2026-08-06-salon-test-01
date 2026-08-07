import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { generateReminderEmailHTML } from '../utils/emailTemplates.js';
import { formatDisplayDate, formatDisplayTime } from '../utils/dateUtils.js';
import dotenv from 'dotenv';
dotenv.config();

// The system is now configured to send REAL emails to your customers using Gmail.
// IMPORTANT: You CANNOT use your normal Gmail password. You MUST use a 16-letter App Password.
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Use SSL/TLS
  auth: {
    user: process.env.EMAIL_USER || 'kusalaravinda2004@gmail.com',
    pass: process.env.EMAIL_PASSWORD, // Must be a Google App Password
  },
  tls: {
    // Allow self‑signed certificates in development (optional)
    rejectUnauthorized: false,
  },
});

// Verify connection on startup to warn user immediately if password is wrong
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ GMAIL AUTHENTICATION FAILED:');
    console.error('Google is blocking your password. To send real emails, you MUST generate a 16-letter App Password.');
    console.error('Go to: https://myaccount.google.com/apppasswords');
  } else {
    console.log('✅ Gmail SMTP connected successfully! Real emails will now be sent to customers.');
  }
});

export const sendConfirmationEmail = async (appointment) => {
  const displayDate = formatDisplayDate(appointment.appointment_date);
  const displayTime = formatDisplayTime(appointment.appointment_time);

  let qrCodeSrc = '';
  let attachments = [];
  try {
    const qrCodeDataURL = await QRCode.toDataURL('Appointment Verified');
    const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, "");
    const qrCodeBuffer = Buffer.from(base64Data, 'base64');
    attachments.push({
      filename: 'qrcode.png',
      content: qrCodeBuffer,
      cid: 'qrcode'
    });
    qrCodeSrc = 'cid:qrcode';
  } catch (err) {
    console.error('Failed to generate QR code for confirmation email:', err);
  }

  const html = `
    <h2>Booking Confirmed!</h2>
    <p>Hi ${appointment.customer_name},</p>
    <p>Your appointment for <strong>${appointment.service_name}</strong> has been confirmed.</p>
    <p><strong>Date:</strong> ${displayDate}<br/>
    <strong>Time:</strong> ${displayTime}</p>
    <p>Booking Reference: ${appointment.id}</p>
    ${qrCodeSrc ? `
    <div style="margin: 20px 0;">
      <p><strong>Your Appointment QR Code</strong></p>
      <img src="${qrCodeSrc}" alt="Appointment QR Code" style="max-width: 150px; border: 1px solid #ccc; padding: 4px;" />
    </div>
    ` : ''}
    <p>We look forward to seeing you!</p>
  `;

  return sendEmail(appointment.customer_email, appointment.customer_name, 'Appointment Confirmed - StylePulse Salon', html, attachments);
};

export const sendReminderEmail = async (appointment) => {
  const displayDate = formatDisplayDate(appointment.appointment_date);
  const displayTime = formatDisplayTime(appointment.appointment_time);

  let qrCodeSrc = '';
  let attachments = [];
  try {
    const qrCodeDataURL = await QRCode.toDataURL('Appointment Verified');
    const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, "");
    const qrCodeBuffer = Buffer.from(base64Data, 'base64');
    attachments.push({
      filename: 'qrcode.png',
      content: qrCodeBuffer,
      cid: 'qrcode'
    });
    qrCodeSrc = 'cid:qrcode';
  } catch (err) {
    console.error('Failed to generate QR code:', err);
  }

  const html = generateReminderEmailHTML({
    customerName: appointment.customer_name,
    serviceName: appointment.service_name,
    displayDate,
    displayTime,
    qrCodeDataURL: qrCodeSrc
  });

  return sendEmail(appointment.customer_email, appointment.customer_name, 'Appointment Reminder – Your Salon Visit is in 1 Hour', html, attachments);
};

const sendEmail = async (toEmail, toName, subject, htmlContent, attachments = []) => {
  const mailOptions = {
    from: `"StylePulse Salon" <${process.env.EMAIL_USER || 'kusalaravinda2004@gmail.com'}>`,
    to: toEmail,
    subject: subject,
    html: htmlContent,
    attachments: attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${toEmail}. Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Failed to send email to ${toEmail}:`, error.message);
    throw error;
  }
};
