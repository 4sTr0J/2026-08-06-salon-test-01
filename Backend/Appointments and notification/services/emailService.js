import '../../config/env.js';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { generateReminderEmailHTML } from '../utils/emailTemplates.js';
import { formatDisplayDate, formatDisplayTime } from '../utils/dateUtils.js';

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

export const sendConfirmationEmail = async (appointment, paymentDetails = {}) => {
  const displayDate = formatDisplayDate(appointment.appointment_date);
  const displayTime = formatDisplayTime(appointment.appointment_time);

  let qrCodeSrc = '';
  let attachments = [];
  try {
    const qrPayload = JSON.stringify({
      id: appointment.id,
      customer: appointment.customer_name,
      service: appointment.service_name,
      date: appointment.appointment_date,
      time: appointment.appointment_time,
      status: 'Paid & Confirmed'
    });
    const qrCodeDataURL = await QRCode.toDataURL(qrPayload);
    const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, "");
    const qrCodeBuffer = Buffer.from(base64Data, 'base64');
    attachments.push({
      filename: 'booking-qrcode.png',
      content: qrCodeBuffer,
      cid: 'qrcode'
    });
    qrCodeSrc = 'cid:qrcode';
  } catch (err) {
    console.error('Failed to generate QR code for confirmation email:', err);
  }

  const discountText = paymentDetails.discountApplied > 0 
    ? `<tr><td style="padding: 6px 0; color: #16a34a; font-weight: 600;">Loyalty Discount Applied:</td><td style="padding: 6px 0; color: #16a34a; text-align: right; font-weight: 700;">- Rs. ${paymentDetails.discountApplied} (${paymentDetails.pointsDeducted} pts)</td></tr>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Successful & Booking Confirmed</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f1115; margin: 0; padding: 24px; color: #e5e7eb;">
      <div style="max-width: 580px; margin: 0 auto; background-color: #1a1d24; border-radius: 16px; overflow: hidden; border: 1px solid #2d3342; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div style="background: linear-gradient(135deg, #ff9f1c 0%, #f59e0b 100%); padding: 28px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">StylePulse Salon</h1>
          <p style="color: rgba(255,255,255,0.95); margin: 6px 0 0 0; font-size: 14px; font-weight: 600;">✓ Payment Approved & Appointment Confirmed</p>
        </div>

        <div style="padding: 28px;">
          <p style="font-size: 16px; margin-top: 0; color: #f3f4f6;">Hello <strong>${appointment.customer_name}</strong>,</p>
          <p style="font-size: 14px; color: #9ca3af; line-height: 1.6;">
            Thank you for booking with StylePulse. Your full card payment was successfully authorized and your reserved salon slot is now locked in.
          </p>

          <div style="background-color: #242933; border: 1px solid #374151; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #9ca3af; font-weight: 600;">Service Booked:</td>
                <td style="padding: 8px 0; color: #f9fafb; text-align: right; font-weight: 700;">${appointment.service_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #9ca3af; font-weight: 600;">Date:</td>
                <td style="padding: 8px 0; color: #f9fafb; text-align: right; font-weight: 600;">${displayDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #9ca3af; font-weight: 600;">Time Slot:</td>
                <td style="padding: 8px 0; color: #ff9f1c; text-align: right; font-weight: 700; font-size: 15px;">${displayTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #9ca3af; font-weight: 600;">Payment Status:</td>
                <td style="padding: 8px 0; color: #2ecc71; text-align: right; font-weight: 700;">PAID IN FULL (Card)</td>
              </tr>
              ${discountText}
              <tr>
                <td style="padding: 8px 0; color: #9ca3af; font-weight: 600;">Booking Reference:</td>
                <td style="padding: 8px 0; color: #9ca3af; text-align: right; font-family: monospace; font-size: 12px;">#${String(appointment.id).slice(0, 8).toUpperCase()}</td>
              </tr>
            </table>
          </div>

          ${qrCodeSrc ? `
          <div style="text-align: center; margin: 24px 0; padding: 18px; background-color: #242933; border-radius: 12px; border: 1px dashed #4b5563;">
            <p style="font-size: 13px; color: #e5e7eb; margin: 0 0 10px 0; font-weight: 600;">Your Appointment QR Verification Code</p>
            <img src="${qrCodeSrc}" alt="Appointment QR Code" style="max-width: 140px; border-radius: 8px; padding: 6px; background-color: #ffffff; display: inline-block;" />
            <p style="font-size: 12px; color: #9ca3af; margin: 8px 0 0 0;">Present this QR code when checking in at the salon.</p>
          </div>
          ` : ''}

          <div style="background-color: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 14px; margin: 20px 0;">
            <p style="font-size: 13px; color: #fbbf24; margin: 0; line-height: 1.5;">
              🛡️ <strong>StylePulse Buffer Policy:</strong> A dedicated 30-minute buffer is automatically scheduled after your appointment. If you encounter slight delays, notify us through your dashboard.
            </p>
          </div>

          <p style="font-size: 14px; color: #9ca3af; margin-top: 24px; text-align: center;">
            Need to manage or reschedule? Visit your <a href="http://localhost:5001/Frontend/CustomerDashboard/dashboard.html" style="color: #ff9f1c; text-decoration: none; font-weight: 600;">Customer Dashboard</a>.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(appointment.customer_email, appointment.customer_name, `✓ Booking Confirmed & Paid: ${appointment.service_name}`, html, attachments);
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
