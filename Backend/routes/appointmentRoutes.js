import express from 'express';
import {
  handleGetAvailableSlots,
  handleNotifyRunningLate,
  handleGetRescheduleQuote,
  handleRescheduleAppointment
} from '../Appointments and notification/controllers/appointmentController.js';
import authMiddleware from '../authMiddleware.js';

const router = express.Router();

/**
 * GET /api/appointments/available?date=YYYY-MM-DD
 * Public endpoint — returns available time slots for a given date.
 * No auth required (read-only, no sensitive data).
 */
router.get('/available', handleGetAvailableSlots);

/**
 * POST /api/appointments/:id/running-late
 * Customer notifies salon of expected delay (in minutes <= 30).
 */
router.post('/:id/running-late', authMiddleware, handleNotifyRunningLate);

/**
 * GET /api/appointments/:id/reschedule-quote
 * Returns reschedule count and whether this reschedule is free or incurs Rs.500 fee.
 */
router.get('/:id/reschedule-quote', authMiddleware, handleGetRescheduleQuote);

/**
 * POST /api/appointments/:id/reschedule
 * Executes the reschedule for the appointment.
 */
router.post('/:id/reschedule', authMiddleware, handleRescheduleAppointment);

export default router;
