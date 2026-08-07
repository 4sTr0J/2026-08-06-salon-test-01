/**
 * Safely parses Date (YYYY-MM-DD) and Time (HH:MM) strings into ISO 8601 strings.
 * Ensures consistent timezone handling across servers.
 */
export const calculateAppointmentAndReminderTimes = (dateStr, timeStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  // Construct a UTC date pretending the input was UTC
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  
  // Asia/Colombo timezone offset is UTC+5:30 -> -330 minutes in JS getTimezoneOffset()
  const colomboOffset = -330;
  const appointmentDate = new Date(utcDate.getTime() + (colomboOffset * 60 * 1000));

  // Subtract 1 hour for reminder time
  const reminderDate = new Date(appointmentDate.getTime() - (60 * 60 * 1000));

  return {
    appointmentISO: appointmentDate.toISOString(),
    reminderISO: reminderDate.toISOString()
  };
};

export const formatDisplayDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-');
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const formatDisplayTime = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};
