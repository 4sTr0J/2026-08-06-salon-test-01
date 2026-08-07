import cron from 'node-cron';
import { fetchDueReminders, updateReminderStatus } from '../services/appointmentService.js';
import { sendReminderEmail } from '../services/emailService.js';

let isJobRunning = false;

const processReminder = async (appointment) => {
  try {
    // Atomic state lock to avoid duplicate triggers
    await updateReminderStatus(appointment.id, 'Processing');
    
    // Dispatch email
    await sendReminderEmail(appointment);
    
    // Mark complete and store the sent time
    await updateReminderStatus(appointment.id, 'Sent', new Date().toISOString());
    console.log(`✅ Reminder email sent successfully to ${appointment.customer_email}`);
  } catch (err) {
    console.error(`❌ Failed sending reminder for ID ${appointment.id}:`, err.message);
    await updateReminderStatus(appointment.id, 'Failed');
  }
};

export const startReminderScheduler = () => {
  console.log('⏰ Starting Cron Scheduler: Will check for reminders every minute.');

  // Execute once every minute
  cron.schedule('* * * * *', async () => {
    if (isJobRunning) {
      console.log('⚠️ Cron job skipped: previous iteration is still running.');
      return;
    }
    
    isJobRunning = true;
    console.log(`[${new Date().toISOString()}] 🔄 Cron Job Executing: Checking for pending reminders...`);

    try {
      // Fetch only due reminders (reminder_time <= now)
      const dueAppointments = await fetchDueReminders();

      if (dueAppointments.length > 0) {
        console.log(`⏰ Found ${dueAppointments.length} pending reminder(s). Processing...`);

        for (const appointment of dueAppointments) {
          await processReminder(appointment);
        }
      } else {
        console.log('✅ No pending reminders found at this time.');
      }
    } catch (err) {
      console.error('❌ Scheduler iteration failed:', err.message);
    } finally {
      isJobRunning = false;
    }
  });
};
