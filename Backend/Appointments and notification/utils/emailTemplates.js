export const generateReminderEmailHTML = ({
  customerName,
  serviceName,
  displayDate,
  displayTime,
  qrCodeDataURL
}) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment Reminder</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px;">
    <div style="max-width: 550px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
      <div style="background-color: #0f172a; padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">StylePulse Salon</h1>
        <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Upcoming Appointment Reminder</p>
      </div>
      <div style="padding: 24px; color: #334155;">
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${customerName},</p>
        <p style="font-size: 14px; color: #475569; line-height: 1.5;">
          This is an automated reminder that your appointment is scheduled in <strong>1 hour</strong>.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Service:</td>
              <td style="padding: 6px 0; color: #0f172a; text-align: right;">${serviceName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Date:</td>
              <td style="padding: 6px 0; color: #0f172a; text-align: right;">${displayDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Time:</td>
              <td style="padding: 6px 0; color: #0f172a; text-align: right;">${displayTime}</td>
            </tr>
          </table>
        </div>
        ${qrCodeDataURL ? `
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 14px; color: #475569; margin-bottom: 8px;"><strong>Your Appointment QR Code</strong></p>
          <img src="${qrCodeDataURL}" alt="Appointment QR Code" style="max-width: 150px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px; background-color: #ffffff;" />
          <p style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Please present this code upon arrival</p>
        </div>
        ` : ''}
        <p style="font-size: 13px; color: #b45309; background-color: #fef3c7; padding: 12px; border-radius: 6px; margin-bottom: 20px; line-height: 1.4;">
          🛡️ <strong>StylePulse Buffer Guarantee:</strong> A 30-minute buffer is reserved after your service. If you are running late, you can inform the salon via your dashboard, and your full session will still be covered.
        </p>
        <p style="font-size: 14px; margin: 0;">Thank you for choosing StylePulse!</p>
      </div>
    </div>
  </body>
  </html>
  `;
};
