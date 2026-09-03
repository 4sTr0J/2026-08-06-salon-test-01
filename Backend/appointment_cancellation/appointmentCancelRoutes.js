import express from 'express';
import { handleCancelAppointment, handleCancelPreview } from './appointmentCancelController.js';
import authMiddleware from '../authMiddleware.js';

const router = express.Router();

// GET /api/appointments/:id/cancel-preview
router.get('/:id/cancel-preview', authMiddleware, handleCancelPreview);

// PUT /api/appointments/:id/cancel
router.put('/:id/cancel', authMiddleware, handleCancelAppointment);

export default router;
