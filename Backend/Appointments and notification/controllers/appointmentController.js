import * as appointmentService from '../services/appointmentService.js';
import { sendConfirmationEmail } from '../services/emailService.js';
import { awardAppointmentPointsHelper } from '../../controllers/loyaltyController.js';
import loyaltyDb from '../../config/loyaltyDb.js';
import crypto from 'crypto';

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

    // 4. Mark all slot intervals that overlap with booked service durations + 30 MIN BUFFER as busy
    const busySlots = new Set();
    const BUFFER_MINUTES = 30; // Dedicated buffer period after each appointment

    bookedAppointments.forEach(apt => {
      const time = apt.appointment_time;
      const serviceName = apt.service_name ? apt.service_name.toLowerCase().trim() : '';
      const duration = durationMap[serviceName] || 30;

      const [h, m] = time.split(':').map(Number);
      const startMinutes = h * 60 + m;
      const endMinutesWithBuffer = startMinutes + duration + BUFFER_MINUTES;

      operatingSlots.forEach(slot => {
        const [sh, sm] = slot.split(':').map(Number);
        const slotMinutes = sh * 60 + sm;
        if (slotMinutes >= startMinutes && slotMinutes < endMinutesWithBuffer) {
          busySlots.add(slot);
        }
      });
    });

    // 5. Filter out past time slots if the appointment date is today
    const now = new Date();
    // Local date formatted as YYYY-MM-DD
    const localYear = now.getFullYear();
    const localMonth = String(now.getMonth() + 1).padStart(2, '0');
    const localDay = String(now.getDate()).padStart(2, '0');
    const todayStr = `${localYear}-${localMonth}-${localDay}`;

    const currentMinutesNow = now.getHours() * 60 + now.getMinutes();

    let availableSlots = operatingSlots.filter(s => !busySlots.has(s));

    if (date < todayStr) {
      // Past date: no slots available
      availableSlots = [];
      operatingSlots.forEach(slot => busySlots.add(slot));
    } else if (date === todayStr) {
      // Today: disable/filter slots whose time has already passed
      availableSlots = availableSlots.filter(slot => {
        const [sh, sm] = slot.split(':').map(Number);
        const slotMinutes = sh * 60 + sm;
        const isPast = slotMinutes <= currentMinutesNow;
        if (isPast) {
          busySlots.add(slot);
        }
        return !isPast;
      });
    }

    return res.status(200).json({ date, availableSlots, bookedSlots: Array.from(busySlots), operatingSlots });
  } catch (error) {
    console.error('Available slots error:', error.message);
    return res.status(500).json({ error: 'Could not fetch available slots.' });
  }
};

export const handleCreateAppointment = async (req, res) => {
  try {
    // 1. Resolve customer details (allow req.body payload or fallback to authenticated req.user)
    const customer_email = req.body.customer_email || (req.user ? req.user.email : null);
    let customer_name = req.body.customer_name || 
      (req.user ? (req.user.fullName || req.user.name || req.user.full_name || req.user.user_metadata?.fullName || req.user.user_metadata?.full_name) : null);
    
    if ((!customer_name || customer_name.toLowerCase() === 'customer') && customer_email) {
      const username = customer_email.split('@')[0];
      customer_name = username.charAt(0).toUpperCase() + username.slice(1);
    }
    if (!customer_name) customer_name = "Customer";
    
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

    // Check if appointment is in the past
    const now = new Date();
    const localYear = now.getFullYear();
    const localMonth = String(now.getMonth() + 1).padStart(2, '0');
    const localDay = String(now.getDate()).padStart(2, '0');
    const todayStr = `${localYear}-${localMonth}-${localDay}`;
    const currentMinutesNow = now.getHours() * 60 + now.getMinutes();

    const [reqH, reqM] = appointment_time.split(':').map(Number);
    const reqMinutes = reqH * 60 + reqM;

    if (appointment_date < todayStr || (appointment_date === todayStr && reqMinutes <= currentMinutesNow)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book an appointment for a past time slot. Please select a future time.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer_email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format.'
      });
    }

    // Points Redemption Logic (up to Rs. 200 discount)
    const pointsToRedeem = parseInt(req.body.redeemPoints || 0, 10);
    let discountApplied = 0;
    let pointsDeducted = 0;

    if (pointsToRedeem > 0) {
      try {
        // Look up customer loyalty account
        const profile = loyaltyDb.prepare("SELECT * FROM profiles WHERE email = ? OR id = ?").get(customer_email, customer_email);
        const targetId = profile ? profile.id : customer_email;
        const account = loyaltyDb.prepare("SELECT * FROM loyalty_accounts WHERE customer_id = ?").get(targetId);

        if (account && account.available_points >= pointsToRedeem) {
          // Point conversion: 100 points = Rs. 1 discount (Max Rs. 200 discount per order = 20,000 points max)
          // E.g., 500 pts = Rs. 5, 5,000 pts = Rs. 50, 10,000 pts = Rs. 100, 20,000 pts = Rs. 200
          const maxDiscount = 200;
          const calculatedDiscount = Math.min(maxDiscount, Math.floor(pointsToRedeem / 100));
          pointsDeducted = calculatedDiscount * 100;
          discountApplied = calculatedDiscount;

          if (pointsDeducted > 0) {
            const newBalance = account.available_points - pointsDeducted;
            loyaltyDb.prepare("UPDATE loyalty_accounts SET available_points = ? WHERE customer_id = ?").run(newBalance, targetId);
            loyaltyDb.prepare(`
              INSERT INTO reward_transactions (id, customer_id, type, points, description, reference_type)
              VALUES (?, ?, 'REDEEM', ?, ?, 'BOOKING_DISCOUNT')
            `).run(crypto.randomUUID(), targetId, -pointsDeducted, `Redeemed for Rs. ${discountApplied} Booking Discount`);
            console.log(`[Loyalty Discount] Deducted ${pointsDeducted} points from ${customer_email} for Rs. ${discountApplied} discount.`);
          }
        }
      } catch (loyaltyErr) {
        console.warn('Loyalty points deduction error:', loyaltyErr.message);
      }
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

    // Immediate Payment & Admin Revenue Ledger Recording
    try {
      let grossAmount = parseFloat(req.body.price || 0);

      // If price wasn't passed, lookup from salon_owner_services
      if (!grossAmount || grossAmount <= 0) {
        try {
          const { data: svc } = await appointmentService.db
            .from('salon_owner_services')
            .select('price')
            .eq('owner_id', salon_id)
            .ilike('name', `%${service_name}%`)
            .maybeSingle();
          if (svc && svc.price) {
            grossAmount = parseFloat(svc.price);
          }
        } catch (e) {}
      }
      if (!grossAmount || grossAmount <= 0) grossAmount = 3500;

      const netAmount = Math.max(0, grossAmount - discountApplied);
      const platformCommissionPct = 10.00;
      const platformCommissionAmt = parseFloat((netAmount * (platformCommissionPct / 100)).toFixed(2));
      const salonEarnings = parseFloat((netAmount - platformCommissionAmt).toFixed(2));
      const paymentId = crypto.randomUUID();

      loyaltyDb.prepare(`
        INSERT INTO payments (
          id, appointment_id, customer_email, salon_id, gross_amount,
          points_discount, net_amount, platform_commission_pct,
          platform_commission_amt, salon_earnings, payment_status,
          payout_status, card_last4, payment_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentId, appointment.id, customer_email, salon_id,
        grossAmount, discountApplied, netAmount, platformCommissionPct,
        platformCommissionAmt, salonEarnings, 'Completed',
        'Pending_Release', req.body.cardLast4 || '1234', req.body.paymentMethod || 'CARD'
      );

      // Record Salon Earnings Ledger (Credit 90%)
      loyaltyDb.prepare(`
        INSERT INTO salon_earnings (
          id, salon_id, payment_id, appointment_id, transaction_type, amount, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(), salon_id, paymentId, appointment.id, 'CREDIT',
        salonEarnings, `Payment collected for appt ${appointment.id.substring(0, 8)}`
      );

      // Record Admin Platform Revenue Ledger (Credit 10%)
      loyaltyDb.prepare(`
        INSERT INTO platform_revenue (
          id, salon_id, payment_id, appointment_id, transaction_type, amount, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(), salon_id, paymentId, appointment.id, 'CREDIT',
        platformCommissionAmt, `Platform commission (10%) on appt ${appointment.id.substring(0, 8)}`
      );

      console.log(`[Admin Ledger] Recorded payment & 10% commission (Rs. ${platformCommissionAmt}) immediately for appt ${appointment.id.substring(0, 8)}`);
    } catch (finErr) {
      console.error('⚠️ Could not record payment in admin ledger immediately:', finErr.message);
    }

    // Send the confirmation email asynchronously with payment discount summary (non-blocking)
    sendConfirmationEmail(appointment, {
      discountApplied,
      pointsDeducted,
      paymentMethod: 'CARD'
    }).catch(err => {
      console.error('⚠️ Could not send confirmation email:', err.message);
    });

    return res.status(201).json({
      success: true,
      message: discountApplied > 0 
        ? `Appointment Confirmed! Applied Rs. ${discountApplied} discount with ${pointsDeducted} Style Points.` 
        : 'Appointment Confirmed!',
      appointment: appointment,
      discountApplied,
      pointsDeducted
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

export const handleNotifyRunningLate = async (req, res) => {
  try {
    const { id } = req.params;
    const { delayMinutes, note } = req.body;
    const customerEmail = req.user?.email;

    if (!id || !delayMinutes) {
      return res.status(400).json({ success: false, message: 'Appointment ID and delay minutes are required.' });
    }

    const { data: apt, error: aptError } = await appointmentService.db
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single();

    if (aptError || !apt) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    if (customerEmail && apt.customer_email !== customerEmail) {
      return res.status(403).json({ success: false, message: 'Unauthorized to update this appointment.' });
    }

    const delayNum = parseInt(delayMinutes, 10);
    let policyNote = '';
    if (delayNum <= 15) {
      policyNote = `Customer notified ${delayNum}m delay. Covered by buffer & grace period.`;
    } else if (delayNum <= 30) {
      policyNote = `Customer notified ${delayNum}m delay. Fully covered within salon's 30-minute post-appointment buffer.`;
    } else {
      policyNote = `Customer notified ${delayNum}m delay. Exceeds 30m buffer. Rescheduling may be required.`;
    }

    // Persist into SQLite late_arrival_notifications
    try {
      loyaltyDb.prepare(`
        INSERT INTO late_arrival_notifications (id, appointment_id, salon_id, customer_name, customer_email, delay_minutes, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(appointment_id) DO UPDATE SET
          delay_minutes = excluded.delay_minutes,
          note = excluded.note,
          created_at = CURRENT_TIMESTAMP;
      `).run(crypto.randomUUID(), id, apt.salon_id || '', apt.customer_name || 'Customer', apt.customer_email || '', delayNum, note || '');
    } catch (dbErr) {
      console.warn('Could not save late alert in db:', dbErr.message);
    }

    console.log(`[Late Arrival Notification] Appointment ${id} (${apt.customer_name}): ${delayNum} mins late. Note: ${note || 'None'}`);

    return res.status(200).json({
      success: true,
      message: `Salon notified! Your ${delayNum}-minute delay has been logged. ${delayNum <= 30 ? 'Your appointment will be accommodated within our 30-minute buffer.' : 'Please coordinate with the salon if you need to reschedule.'}`,
      delayMinutes: delayNum,
      policyNote
    });
  } catch (error) {
    console.error('Late notification error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to submit late notification.' });
  }
};

export const getSalonLateNotifications = (salonId) => {
  try {
    return loyaltyDb.prepare("SELECT * FROM late_arrival_notifications WHERE salon_id = ? ORDER BY created_at DESC").all(salonId);
  } catch (e) {
    console.error('Failed to get salon late notifications:', e);
    return [];
  }
};

/**
 * GET /api/appointments/:id/reschedule-quote
 * Checks how many times this appointment has been rescheduled.
 * 1st reschedule = Rs. 0 (Free)
 * 2nd and subsequent = Rs. 500
 */
export const handleGetRescheduleQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const customerEmail = req.user?.email;

    const { data: apt, error: aptError } = await appointmentService.db
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single();

    if (aptError || !apt) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    if (customerEmail && apt.customer_email !== customerEmail) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    // Count past reschedules
    const pastReschedules = loyaltyDb.prepare("SELECT COUNT(*) as count FROM appointment_reschedules WHERE appointment_id = ?").get(id);
    const count = pastReschedules?.count || 0;
    const MAX_RESCHEDULES = 3;

    if (count >= MAX_RESCHEDULES) {
      return res.status(200).json({
        success: true,
        appointment: apt,
        pastReschedulesCount: count,
        isAllowed: false,
        maxLimitReached: true,
        fee: 0,
        message: `Maximum reschedule limit reached (${MAX_RESCHEDULES} of ${MAX_RESCHEDULES} used). This appointment cannot be rescheduled further.`
      });
    }

    const isFree = count === 0;
    const fee = isFree ? 0 : 500;
    const totalAccumulatedFee = count * 500;
    const remainingReschedules = MAX_RESCHEDULES - count;

    return res.status(200).json({
      success: true,
      appointment: apt,
      pastReschedulesCount: count,
      remainingReschedules: remainingReschedules,
      isAllowed: true,
      maxLimitReached: false,
      isFree: isFree,
      fee: fee,
      totalAccumulatedFee: totalAccumulatedFee,
      message: isFree 
        ? `Your 1st reschedule is completely FREE! (${remainingReschedules} reschedules remaining)` 
        : `This is reschedule #${count + 1} of ${MAX_RESCHEDULES}. A fee of Rs. 500 applies (Payable at the salon).`
    });
  } catch (error) {
    console.error('Reschedule quote error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve reschedule quote.' });
  }
};

/**
 * POST /api/appointments/:id/reschedule
 * Updates appointment date & time, applies buffer check and tracks fee
 */
export const handleRescheduleAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { newDate, newTime } = req.body;
    const customerEmail = req.user?.email;

    if (!id || !newDate || !newTime) {
      return res.status(400).json({ success: false, message: 'Appointment ID, new date, and new time are required.' });
    }

    // 1. Fetch current appointment
    const { data: apt, error: aptError } = await appointmentService.db
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single();

    if (aptError || !apt) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    if (customerEmail && apt.customer_email !== customerEmail) {
      return res.status(403).json({ success: false, message: 'Unauthorized to reschedule this appointment.' });
    }

    // 2. Check maximum 3 reschedules policy
    const pastReschedules = loyaltyDb.prepare("SELECT COUNT(*) as count FROM appointment_reschedules WHERE appointment_id = ?").get(id);
    const count = pastReschedules?.count || 0;
    const MAX_RESCHEDULES = 3;

    if (count >= MAX_RESCHEDULES) {
      return res.status(400).json({
        success: false,
        message: `Maximum reschedule limit reached (${MAX_RESCHEDULES} of ${MAX_RESCHEDULES} used). You cannot reschedule this appointment again.`
      });
    }

    // 3. Validate target slot availability with buffer
    const bookedAppointments = await appointmentService.getBookedSlotsForDate(apt.salon_id, newDate);
    const { data: services } = await appointmentService.db.from('salon_owner_services').select('name, duration');
    const durationMap = {};
    (services || []).forEach(s => { durationMap[s.name.toLowerCase().trim()] = parseInt(s.duration) || 30; });

    const [reqH, reqM] = newTime.split(':').map(Number);
    const reqStart = reqH * 60 + reqM;
    const reqDuration = durationMap[apt.service_name.toLowerCase().trim()] || 30;
    const reqEndWithBuffer = reqStart + reqDuration + 30;

    for (const other of bookedAppointments) {
      // Exclude self if rescheduling on same day
      if (other.id === id) continue;
      const otherDuration = durationMap[(other.service_name || '').toLowerCase().trim()] || 30;
      const [oH, oM] = other.appointment_time.split(':').map(Number);
      const oStart = oH * 60 + oM;
      const oEndWithBuffer = oStart + otherDuration + 30;

      if (reqStart < oEndWithBuffer && oStart < reqEndWithBuffer) {
        return res.status(409).json({ success: false, message: 'The requested slot is already taken. Please choose another time.' });
      }
    }

    // 4. Reschedule fee calculation: 1st is FREE (0), each subsequent is Rs. 500
    const feeCharged = count === 0 ? 0 : 500;

    // 4. Update appointment in Supabase
    const { data: updatedApt, error: updateError } = await appointmentService.db
      .from('appointments')
      .update({
        appointment_date: newDate,
        appointment_time: newTime,
        appointment_datetime: `${newDate}T${newTime}:00`,
        reminder_time: `${newDate}T${newTime}:00`,
        reminder_status: 'Pending',
        booking_status: 'Confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ success: false, message: `Failed to update appointment: ${updateError.message}` });
    }

    // 5. Track reschedule history
    try {
      loyaltyDb.prepare(`
        INSERT INTO appointment_reschedules (id, appointment_id, customer_email, previous_date, previous_time, new_date, new_time, reschedule_count, fee_charged)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), id, apt.customer_email, apt.appointment_date, apt.appointment_time, newDate, newTime, count + 1, feeCharged);
      
      // Clean up previous late alert if any
      loyaltyDb.prepare("DELETE FROM late_arrival_notifications WHERE appointment_id = ?").run(id);
    } catch (dbErr) {
      console.warn("Could not log reschedule record:", dbErr.message);
    }

    // Calculate total cumulative reschedule fee for this appointment
    const totalFees = loyaltyDb.prepare("SELECT SUM(fee_charged) as total FROM appointment_reschedules WHERE appointment_id = ?").get(id);
    const totalAccumulatedFee = totalFees?.total || 0;

    return res.status(200).json({
      success: true,
      message: `Appointment successfully rescheduled to ${newDate} at ${newTime}! ${feeCharged > 0 ? `Reschedule fee (+Rs. 500) added to your total bill to be paid at the salon.` : '1st reschedule is 100% FREE!'}`,
      appointment: updatedApt,
      feeCharged: feeCharged,
      totalRescheduleFee: totalAccumulatedFee,
      rescheduleCount: count + 1
    });
  } catch (error) {
    console.error('Reschedule execution error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to reschedule appointment.' });
  }
};

