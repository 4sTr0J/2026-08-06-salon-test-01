import express from 'express';
import { handleGetAvailableSlots } from '../Appointments and notification/controllers/appointmentController.js';

const router = express.Router();

/**
 * GET /api/appointments/available?date=YYYY-MM-DD
 * Public endpoint — returns available time slots for a given date.
 * No auth required (read-only, no sensitive data).
 */
router.get('/available', handleGetAvailableSlots);

export default router;
