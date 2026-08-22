import express from 'express';
import { handleCancelAppointment } from './appointmentCancelController.js';
import authMiddleware from '../authMiddleware.js';

const router = express.Router();

// PUT /api/appointments/:id/cancel
router.put('/:id/cancel', authMiddleware, handleCancelAppointment);

export default router;
