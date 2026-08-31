import * as appointmentService from '../services/appointmentService.js';
import { sendConfirmationEmail } from '../services/emailService.js';
import { awardAppointmentPointsHelper } from '../../controllers/loyaltyController.js';

// All salon operating slots (9am – 6:30pm, every 30 min)
const ALL_SLOTS = [
  '09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30',
  '15:00','15:30','16:00','16:30','17:00','17:30',
  '18:00','18:30'
];

/**
 * GET /api/appointments/available?date=YYYY-MM-DD
 * Returns the list of time slots that are still available for a given date.
 * Publicly accessible — no auth required (read-only).
 */
export const handleGetAvailableSlots = async (req, res) => {
  try {
    const { date, salonId } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
    }

    // 1. Fetch all appointments booked for this date and specific salon
    const bookedAppointments = await appointmentService.getBookedSlotsForDate(salonId, date);

    // 2. Fetch specific salon operating hours
    let startHour = 9;
    let startMin = 0;
    let endHour = 18;
    let endMin = 30;

    if (salonId) {
      try {
        const { data: salon } = await appointmentService.db
          .from('salon_owners')
          .select('operating_start, operating_end')
          .eq('id', salonId)
          .maybeSingle();

        if (salon) {
          if (salon.operating_start) {
            const [sh, sm] = salon.operating_start.split(':').map(Number);
            startHour = sh;
            startMin = sm;
          }
          if (salon.operating_end) {
            const [eh, em] = salon.operating_end.split(':').map(Number);
            endHour = eh;
            endMin = em;
          }
        }
      } catch (err) {
        console.warn("Failed to fetch custom operating hours, using default 9am-6:30pm:", err.message);
      }
    }

    // Generate dynamic operating slots
    const operatingSlots = [];
    let currentMin = startHour * 60 + startMin;
    const limitMin = endHour * 60 + endMin;
    while (currentMin <= limitMin) {
      const hStr = String(Math.floor(currentMin / 60)).padStart(2, '0');
      const mStr = String(currentMin % 60).padStart(2, '0');
      operatingSlots.push(`${hStr}:${mStr}`);
      currentMin += 30;
    }

    // 3. Fetch the salon services to get their durations
    const { data: services, error: sError } = await appointmentService.db
      .from('salon_owner_services')
      .select('name, duration');

    const durationMap = {};
    if (!sError && services) {
      services.forEach(s => {
        durationMap[s.name.toLowerCase().trim()] = parseInt(s.duration) || 30;
      });
    }

    // 4. Mark all slot intervals that overlap with booked service durations as busy
    const busySlots = new Set();

    bookedAppointments.forEach(apt => {
      const time = apt.appointment_time;
      const serviceName = apt.service_name ? apt.service_name.toLowerCase().trim() : '';
      const duration = durationMap[serviceName] || 30;

      const [h, m] = time.split(':').map(Number);
      const startMinutes = h * 60 + m;
      const endMinutes = startMinutes + duration;

      operatingSlots.forEach(slot => {
        const [sh, sm] = slot.split(':').map(Number);
        const slotMinutes = sh * 60 + sm;
        if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
          busySlots.add(slot);
        }
      });
    });

    const availableSlots = operatingSlots.filter(s => !busySlots.has(s));

    return res.status(200).json({ date, availableSlots, bookedSlots: Array.from(busySlots), operatingSlots });
  } catch (error) {
    console.error('Available slots error:', error.message);
    return res.status(500).json({ error: 'Could not fetch available slots.' });
  }
};

export const handleCreateAppointment = async (req, res) => {
  try {
    // 1. Resolve customer details (allow req.body payload or fallback to authenticated req.user)
    const customer_name = req.body.customer_name || (req.user ? (req.user.name || req.user.full_name) : null) || "Customer";
    const customer_email = req.body.customer_email || (req.user ? req.user.email : null);
    
    // 2. Resolve other properties, mapping from both potential formats
    const salon_id = req.body.salonId || req.body.salon_id;
    const service_name = req.body.serviceName || req.body.service_name;
    const appointment_date = req.body.date || req.body.appointment_date;
    const appointment_time = req.body.time || req.body.appointment_time;

    // Strict validation
    if (!customer_name || !customer_email || !service_name || !appointment_date || !appointment_time) {
      return res.status(400).json({
        success: false,
        message: 'Validation Failed. All fields are required.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer_email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format.'
      });
    }

    // Call service to insert
    const appointment = await appointmentService.createAppointment({
      salon_id,
      customer_name,
      customer_email,
      service_name,
      appointment_date,
      appointment_time
    });

    // Send the confirmation email immediately
    try {
      await sendConfirmationEmail(appointment);
    } catch (err) {
      console.error('⚠️ Could not send confirmation email:', err.message);
      // We do not fail the booking if email fails, but log it.
    }

    return res.status(201).json({
      success: true,
      message: 'Appointment Confirmed!',
      appointment: appointment
    });

  } catch (error) {
    console.error(' Controller Error:', error);
    
    // Return specific double booking messages or bad request errors
    if (error.message === 'someone just booked the slot you are trying to book') {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing booking.',
      error: error.message
    });
  }
};

