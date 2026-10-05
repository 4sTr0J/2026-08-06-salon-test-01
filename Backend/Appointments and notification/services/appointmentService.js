import supabase, { supabaseAdmin } from '../../config/supabase.js';
import { calculateAppointmentAndReminderTimes } from '../utils/dateUtils.js';

// Use service-role admin client to bypass RLS for all server-side operations.
// RLS policies require auth.uid() which is null in a backend context.
export const db = supabaseAdmin || supabase;

/**
 * Returns an array of booked appointment details containing time and service name for a given date.
 */
export const getBookedSlotsForDate = async (salonId, date) => {
  let query = db
    .from('appointments')
    .select('id, appointment_time, service_name, booking_status')
    .eq('appointment_date', date)
    .neq('booking_status', 'Cancelled');

  if (salonId) {
    query = query.eq('salon_id', salonId);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('⚠️ Could not fetch booked slots:', error.message);
    return [];
  }
  return data || [];
};



export const createAppointment = async (payload) => {
  const { salon_id, customer_name, customer_email, service_name, appointment_date, appointment_time } = payload;

  const { appointmentISO, reminderISO } = calculateAppointmentAndReminderTimes(
    appointment_date,
    appointment_time
  );

  // 1. Fetch all existing appointments for the same date and same salon to verify overlap collisions
  const bookedAppointments = await getBookedSlotsForDate(salon_id, appointment_date);

  // Fetch all salon service durations
  const { data: services, error: sError } = await db
    .from('salon_owner_services')
    .select('name, duration');

  const durationMap = {};
  if (!sError && services) {
    services.forEach(s => {
      durationMap[s.name.toLowerCase().trim()] = parseInt(s.duration) || 30;
    });
  }

  // Calculate the target request start and end times in minutes
  const [reqH, reqM] = appointment_time.split(':').map(Number);
  const reqStart = reqH * 60 + reqM;
  const reqDuration = durationMap[service_name.toLowerCase().trim()] || 30;
  const reqEnd = reqStart + reqDuration;

  // Verify if any existing booking overlaps with this interval (including 30 min buffer)
  const BUFFER_MINUTES = 30;
  for (const apt of bookedAppointments) {
    const aptTime = apt.appointment_time;
    const aptService = apt.service_name ? apt.service_name.toLowerCase().trim() : '';
    const aptDuration = durationMap[aptService] || 30;

    const [aptH, aptM] = aptTime.split(':').map(Number);
    const aptStart = aptH * 60 + aptM;
    const aptEndWithBuffer = aptStart + aptDuration + BUFFER_MINUTES;

    // Check for overlap: [reqStart, reqEnd + BUFFER_MINUTES) intersects with [aptStart, aptEnd + BUFFER_MINUTES)
    const reqEndWithBuffer = reqEnd + BUFFER_MINUTES;
    if (reqStart < aptEndWithBuffer && aptStart < reqEndWithBuffer) {
      throw new Error('someone just booked the slot you are trying to book');
    }
  }

  const record = {
    salon_id,
    customer_name,
    customer_email,
    service_name,
    appointment_date,
    appointment_time,
    appointment_datetime: appointmentISO,
    reminder_time: reminderISO,
    reminder_status: 'Pending',
    booking_status: 'Confirmed'
  };

  // 2. Perform the insertion.
  const { data, error } = await db
    .from('appointments')
    .insert([record])
    .select()
    .single();

  // If a race condition happened and another request managed to write a split second before us,
  // we catch Supabase unique constraint violations (if any exist) or double check after insertion.
  if (error) {
    throw new Error(`Database Error: ${error.message}`);
  }

  return data;
};

export const fetchDueReminders = async () => {
  const nowISO = new Date().toISOString();

  const { data, error } = await db
    .from('appointments')
    .select('*')
    .eq('reminder_status', 'Pending')
    .neq('booking_status', 'Cancelled')
    .lte('reminder_time', nowISO);

  if (error) throw new Error(`Query Error: ${error.message}`);
  return data || [];
};

export const updateReminderStatus = async (id, status, sentAt = null) => {
  const updatePayload = {
    reminder_status: status,
    updated_at: new Date().toISOString()
  };

  const { error } = await db
    .from('appointments')
    .update(updatePayload)
    .eq('id', id);

  if (error) {
    console.error(`Failed status update for ID ${id}: ${error.message}`);
  }
};
